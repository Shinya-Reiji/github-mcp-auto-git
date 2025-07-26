/**
 * Error Recovery System - 堅牢なエラーハンドリング・リカバリー機能
 * Constitutional AI原則の「Fail Fast」に基づく高度なエラー処理
 */

import { promises as fs } from 'fs';
import { join } from 'path';

// エラー分類とレベル定義
export enum ErrorLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  NETWORK = 'network',
  FILE_SYSTEM = 'file_system',
  GIT_OPERATION = 'git_operation',
  GITHUB_API = 'github_api',
  SUBAGENT = 'subagent',
  CONFIGURATION = 'configuration',
  PERMISSION = 'permission',
  VALIDATION = 'validation'
}

export interface ErrorContext {
  operation: string;
  timestamp: Date;
  workingDir: string;
  files?: string[];
  attempt: number;
  metadata?: Record<string, any>;
}

export interface RecoveryAction {
  type: 'retry' | 'fallback' | 'skip' | 'abort' | 'manual';
  description: string;
  maxAttempts?: number;
  delayMs?: number;
  fallbackFunction?: () => Promise<any>;
}

export interface ErrorReport {
  id: string;
  level: ErrorLevel;
  category: ErrorCategory;
  message: string;
  originalError: Error;
  context: ErrorContext;
  recoveryAction: RecoveryAction;
  resolved: boolean;
  resolutionTime?: number;
  finalOutcome?: 'success' | 'failure' | 'partial';
}

export class ErrorRecoverySystem {
  private errorLog: ErrorReport[] = [];
  private retryCount: Map<string, number> = new Map();
  private maxRetries = 3;
  private baseDelayMs = 1000;

  /**
   * メインエラーハンドリング関数 - Fail Fast原則
   */
  async handleError<T>(
    error: Error,
    context: ErrorContext,
    fallbackFn?: () => Promise<T>
  ): Promise<T> {
    const errorReport = this.createErrorReport(error, context);
    this.errorLog.push(errorReport);

    console.error(`🚨 [${errorReport.level.toUpperCase()}] ${errorReport.category}: ${errorReport.message}`);
    console.error(`📍 Context: ${errorReport.context.operation} (attempt ${errorReport.context.attempt})`);

    // Critical エラーは即座に停止（Fail Fast）
    if (errorReport.level === ErrorLevel.CRITICAL) {
      await this.logErrorToFile(errorReport);
      throw new Error(`CRITICAL ERROR: ${errorReport.message}. Operation aborted.`);
    }

    // リカバリーアクションの実行
    return await this.executeRecoveryAction(errorReport, fallbackFn);
  }

  /**
   * エラー分類とリカバリー戦略の決定
   */
  private createErrorReport(error: Error, context: ErrorContext): ErrorReport {
    const category = this.categorizeError(error);
    const level = this.determineErrorLevel(error, category, context);
    const recoveryAction = this.determineRecoveryAction(category, level, context);

    return {
      id: this.generateErrorId(),
      level,
      category,
      message: error.message,
      originalError: error,
      context,
      recoveryAction,
      resolved: false
    };
  }

  /**
   * エラー分類
   */
  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    // ネットワークエラー
    if (message.includes('network') || message.includes('timeout') || 
        message.includes('enotfound') || message.includes('econnrefused')) {
      return ErrorCategory.NETWORK;
    }

    // GitHub API エラー
    if (message.includes('github') || message.includes('octokit') || 
        message.includes('api rate limit') || message.includes('unauthorized')) {
      return ErrorCategory.GITHUB_API;
    }

    // Git操作エラー
    if (message.includes('git') || message.includes('repository') || 
        message.includes('commit') || message.includes('push')) {
      return ErrorCategory.GIT_OPERATION;
    }

    // ファイルシステムエラー
    if (message.includes('enoent') || message.includes('eacces') || 
        message.includes('file') || message.includes('directory')) {
      return ErrorCategory.FILE_SYSTEM;
    }

    // 権限エラー
    if (message.includes('permission') || message.includes('unauthorized') || 
        message.includes('forbidden') || message.includes('eacces')) {
      return ErrorCategory.PERMISSION;
    }

    // サブエージェントエラー
    if (message.includes('subagent') || message.includes('agent') || 
        stack.includes('subagent-manager')) {
      return ErrorCategory.SUBAGENT;
    }

    // 設定エラー
    if (message.includes('config') || message.includes('invalid') || 
        message.includes('missing')) {
      return ErrorCategory.CONFIGURATION;
    }

    return ErrorCategory.VALIDATION;
  }

  /**
   * エラーレベルの決定
   */
  private determineErrorLevel(error: Error, category: ErrorCategory, context: ErrorContext): ErrorLevel {
    const message = error.message.toLowerCase();

    // Critical レベル - 即座に停止すべきエラー
    if (message.includes('secret') || message.includes('credential') || 
        message.includes('destructive') || message.includes('security')) {
      return ErrorLevel.CRITICAL;
    }

    if (category === ErrorCategory.PERMISSION && context.operation.includes('commit')) {
      return ErrorLevel.CRITICAL;
    }

    // High レベル - 重要だが回復可能
    if (category === ErrorCategory.GITHUB_API && message.includes('rate limit')) {
      return ErrorLevel.HIGH;
    }

    if (category === ErrorCategory.GIT_OPERATION && context.attempt > 2) {
      return ErrorLevel.HIGH;
    }

    // Medium レベル - 一般的なエラー
    if (category === ErrorCategory.NETWORK || category === ErrorCategory.FILE_SYSTEM) {
      return ErrorLevel.MEDIUM;
    }

    // Low レベル - 軽微なエラー
    return ErrorLevel.LOW;
  }

  /**
   * リカバリーアクション決定
   */
  private determineRecoveryAction(
    category: ErrorCategory, 
    level: ErrorLevel, 
    context: ErrorContext
  ): RecoveryAction {
    switch (category) {
      case ErrorCategory.NETWORK:
        return {
          type: 'retry',
          description: 'ネットワーク接続を再試行',
          maxAttempts: 3,
          delayMs: this.calculateBackoffDelay(context.attempt)
        };

      case ErrorCategory.GITHUB_API:
        if (level === ErrorLevel.HIGH) {
          return {
            type: 'retry',
            description: 'GitHub API レート制限による待機後再試行',
            maxAttempts: 2,
            delayMs: 60000 // 1分待機
          };
        }
        return {
          type: 'fallback',
          description: 'GitHub操作をスキップしてローカル処理を継続',
          fallbackFunction: () => this.createLocalOnlyFallback(context)
        };

      case ErrorCategory.GIT_OPERATION:
        if (level === ErrorLevel.HIGH) {
          return {
            type: 'manual',
            description: 'Git操作が複数回失敗。手動確認が必要です。'
          };
        }
        return {
          type: 'retry',
          description: 'Git操作を再試行',
          maxAttempts: 2,
          delayMs: 2000
        };

      case ErrorCategory.FILE_SYSTEM:
        return {
          type: 'retry',
          description: 'ファイルアクセスを再試行',
          maxAttempts: 2,
          delayMs: 1000
        };

      case ErrorCategory.SUBAGENT:
        return {
          type: 'fallback',
          description: 'サブエージェント処理をフォールバック実装で継続',
          fallbackFunction: () => this.createSubagentFallback(context)
        };

      case ErrorCategory.PERMISSION:
        return {
          type: 'abort',
          description: '権限エラー: 手動で権限を確認してください'
        };

      case ErrorCategory.CONFIGURATION:
        return {
          type: 'abort',
          description: '設定エラー: 設定ファイルを確認してください'
        };

      default:
        return {
          type: 'skip',
          description: '不明なエラー: 処理をスキップして継続'
        };
    }
  }

  /**
   * リカバリーアクション実行
   */
  private async executeRecoveryAction<T>(
    errorReport: ErrorReport, 
    fallbackFn?: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const { recoveryAction, context } = errorReport;

    try {
      switch (recoveryAction.type) {
        case 'retry':
          return await this.executeRetry(errorReport, fallbackFn);

        case 'fallback':
          console.log(`🔄 フォールバック処理を実行: ${recoveryAction.description}`);
          const result = recoveryAction.fallbackFunction 
            ? await recoveryAction.fallbackFunction()
            : (fallbackFn ? await fallbackFn() : null);
          this.markResolved(errorReport, 'partial', Date.now() - startTime);
          return result;

        case 'skip':
          console.log(`⏭️ 処理をスキップ: ${recoveryAction.description}`);
          this.markResolved(errorReport, 'partial', Date.now() - startTime);
          return null as T;

        case 'abort':
          console.error(`🛑 処理を中止: ${recoveryAction.description}`);
          this.markResolved(errorReport, 'failure', Date.now() - startTime);
          throw new Error(`Operation aborted: ${recoveryAction.description}`);

        case 'manual':
          console.warn(`👤 手動確認が必要: ${recoveryAction.description}`);
          this.markResolved(errorReport, 'failure', Date.now() - startTime);
          throw new Error(`Manual intervention required: ${recoveryAction.description}`);

        default:
          throw new Error(`Unknown recovery action: ${recoveryAction.type}`);
      }
    } catch (error) {
      this.markResolved(errorReport, 'failure', Date.now() - startTime);
      throw error;
    }
  }

  /**
   * リトライ実行
   */
  private async executeRetry<T>(
    errorReport: ErrorReport, 
    fallbackFn?: () => Promise<T>
  ): Promise<T> {
    const { recoveryAction, context } = errorReport;
    const maxAttempts = recoveryAction.maxAttempts || this.maxRetries;
    const retryKey = `${context.operation}-${context.workingDir}`;
    
    const currentAttempts = this.retryCount.get(retryKey) || 0;
    
    if (currentAttempts >= maxAttempts) {
      console.error(`❌ 最大再試行回数に到達: ${maxAttempts} 回`);
      throw new Error(`Max retry attempts reached: ${maxAttempts}`);
    }

    const delayMs = recoveryAction.delayMs || this.calculateBackoffDelay(currentAttempts);
    console.log(`🔄 再試行 ${currentAttempts + 1}/${maxAttempts} (${delayMs}ms後): ${recoveryAction.description}`);
    
    await this.delay(delayMs);
    this.retryCount.set(retryKey, currentAttempts + 1);

    // 再試行はfallbackFnを実行
    if (!fallbackFn) {
      throw new Error('No retry function provided');
    }

    const startTime = Date.now();
    try {
      const result = await fallbackFn();
      this.markResolved(errorReport, 'success', Date.now() - startTime);
      this.retryCount.delete(retryKey); // 成功時はカウントリセット
      return result;
    } catch (retryError) {
      const error = retryError as Error;
      console.warn(`⚠️ 再試行失敗: ${error.message}`);
      throw error;
    }
  }

  /**
   * フォールバック実装
   */
  private async createLocalOnlyFallback(context: ErrorContext): Promise<any> {
    console.log('📋 ローカルのみでの処理を実行');
    return {
      success: true,
      message: 'GitHub操作はスキップされましたが、ローカル処理は完了しました',
      details: {
        operation: context.operation,
        timestamp: new Date().toISOString(),
        warning: 'GitHub連携が無効です'
      }
    };
  }

  private async createSubagentFallback(context: ErrorContext): Promise<any> {
    console.log('🤖 サブエージェントフォールバック処理を実行');
    return {
      safetyScore: 70,
      level: 'WARNING',
      risks: [],
      recommendations: ['エラー発生のため簡易分析を実行しました'],
      autoApprove: false,
      confidence: 0.3
    };
  }

  /**
   * ユーティリティ関数
   */
  private calculateBackoffDelay(attempt: number): number {
    return Math.min(this.baseDelayMs * Math.pow(2, attempt), 30000); // 最大30秒
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private markResolved(
    errorReport: ErrorReport, 
    outcome: 'success' | 'failure' | 'partial', 
    resolutionTime: number
  ): void {
    errorReport.resolved = true;
    errorReport.finalOutcome = outcome;
    errorReport.resolutionTime = resolutionTime;
    
    console.log(`✅ エラー解決: ${errorReport.id} (${outcome}, ${resolutionTime}ms)`);
  }

  private async logErrorToFile(errorReport: ErrorReport): Promise<void> {
    try {
      const logDir = join(process.cwd(), 'logs');
      await fs.mkdir(logDir, { recursive: true });
      
      const logFile = join(logDir, `error-${new Date().toISOString().split('T')[0]}.json`);
      const logEntry = {
        ...errorReport,
        originalError: {
          message: errorReport.originalError.message,
          stack: errorReport.originalError.stack
        }
      };
      
      await fs.appendFile(logFile, JSON.stringify(logEntry, null, 2) + '\n');
    } catch (logError) {
      console.error('Failed to log error to file:', logError);
    }
  }

  /**
   * エラー統計とヘルスチェック
   */
  getErrorStatistics(): {
    total: number;
    byLevel: Record<ErrorLevel, number>;
    byCategory: Record<ErrorCategory, number>;
    resolvedCount: number;
    avgResolutionTime: number;
  } {
    const stats = {
      total: this.errorLog.length,
      byLevel: {} as Record<ErrorLevel, number>,
      byCategory: {} as Record<ErrorCategory, number>,
      resolvedCount: 0,
      avgResolutionTime: 0
    };

    // 初期化
    Object.values(ErrorLevel).forEach(level => stats.byLevel[level] = 0);
    Object.values(ErrorCategory).forEach(category => stats.byCategory[category] = 0);

    let totalResolutionTime = 0;

    this.errorLog.forEach(error => {
      stats.byLevel[error.level]++;
      stats.byCategory[error.category]++;
      
      if (error.resolved) {
        stats.resolvedCount++;
        if (error.resolutionTime) {
          totalResolutionTime += error.resolutionTime;
        }
      }
    });

    stats.avgResolutionTime = stats.resolvedCount > 0 
      ? totalResolutionTime / stats.resolvedCount 
      : 0;

    return stats;
  }

  /**
   * システムヘルスチェック
   */
  checkSystemHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    message: string;
    recommendations: string[];
  } {
    const stats = this.getErrorStatistics();
    const recentErrors = this.errorLog.filter(
      error => Date.now() - error.context.timestamp.getTime() < 3600000 // 1時間以内
    );

    const criticalCount = stats.byLevel[ErrorLevel.CRITICAL];
    const recentCriticalCount = recentErrors.filter(e => e.level === ErrorLevel.CRITICAL).length;
    const unresolved = stats.total - stats.resolvedCount;

    if (criticalCount > 0 || recentCriticalCount > 0) {
      return {
        status: 'critical',
        message: `${criticalCount}個のクリティカルエラーが検出されています`,
        recommendations: [
          'システム管理者に即座に連絡してください',
          'すべてのGit操作を一時停止してください',
          'セキュリティログを確認してください'
        ]
      };
    }

    if (unresolved > 5 || recentErrors.length > 10) {
      return {
        status: 'warning',
        message: `未解決エラー${unresolved}個、直近1時間で${recentErrors.length}個のエラーが発生`,
        recommendations: [
          'ネットワーク接続を確認してください',
          'GitHub API制限を確認してください',
          'システムリソースを確認してください'
        ]
      };
    }

    return {
      status: 'healthy',
      message: 'システムは正常に動作しています',
      recommendations: []
    };
  }

  /**
   * エラーログのクリーンアップ
   */
  clearOldErrors(olderThanHours: number = 24): number {
    const cutoff = Date.now() - (olderThanHours * 3600000);
    const initialCount = this.errorLog.length;
    
    this.errorLog = this.errorLog.filter(
      error => error.context.timestamp.getTime() > cutoff
    );
    
    const removed = initialCount - this.errorLog.length;
    console.log(`🧹 ${removed}個の古いエラーログをクリーンアップしました`);
    return removed;
  }
}