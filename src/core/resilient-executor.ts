/**
 * Resilient Executor - 堅牢な実行環境
 * 重要な操作に対する包括的なエラーハンドリングとリカバリー
 */

import { ErrorRecoverySystem, ErrorCategory, ErrorLevel } from './error-recovery.js';

export interface ExecutionOptions {
  maxRetries?: number;
  timeoutMs?: number;
  critical?: boolean;
  fallbackRequired?: boolean;
  description?: string;
  claudeCodeOptimized?: boolean;
  adaptiveTimeout?: boolean;
  priorityLevel?: 'low' | 'medium' | 'high' | 'critical';
}

export interface ExecutionResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  executionTime: number;
  warnings: string[];
}

export class ResilientExecutor {
  private errorRecovery: ErrorRecoverySystem;
  private executionHistory: Map<string, number[]> = new Map();

  constructor() {
    this.errorRecovery = new ErrorRecoverySystem();
  }

  /**
   * 堅牢な関数実行
   */
  async execute<T>(
    operation: () => Promise<T>,
    context: {
      name: string;
      workingDir: string;
      files?: string[];
      metadata?: Record<string, any>;
    },
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult<T>> {
    const startTime = Date.now();
    const maxRetries = options.maxRetries || 3;
    let timeoutMs = options.timeoutMs || this.calculateOptimalTimeout(context.name, options);
    const warnings: string[] = [];
    let attempts = 0;
    let lastError: Error | null = null;

    console.log(`🚀 堅牢実行開始: ${context.name} (最大${maxRetries}回試行)`);

    for (attempts = 1; attempts <= maxRetries; attempts++) {
      try {
        // 適応的タイムアウト調整
        if (options.adaptiveTimeout && attempts > 1) {
          timeoutMs = this.adjustTimeoutForRetry(timeoutMs, attempts, context.name);
        }

        // Claude Code最適化処理
        if (options.claudeCodeOptimized) {
          await this.optimizeForClaudeCode(context, options);
        }

        // タイムアウト付き実行
        const result = await this.executeWithTimeout(operation, timeoutMs);
        
        const executionTime = Date.now() - startTime;
        console.log(`✅ 実行成功: ${context.name} (${attempts}回目, ${executionTime}ms)`);
        
        // 実行履歴を記録（適応的タイムアウトのため）
        this.recordExecutionTime(context.name, executionTime);
        
        return {
          success: true,
          data: result,
          attempts,
          executionTime,
          warnings
        };

      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️ 実行失敗 ${attempts}/${maxRetries}: ${lastError.message}`);

        // クリティカル操作で重大エラーの場合は即座に停止
        if (options.critical && this.isCriticalError(lastError)) {
          console.error(`🚨 クリティカルエラー検出、実行停止: ${lastError.message}`);
          break;
        }

        // 最後の試行でない場合はエラーハンドリング実行
        if (attempts < maxRetries) {
          try {
            await this.errorRecovery.handleError(
              lastError,
              {
                operation: context.name,
                timestamp: new Date(),
                workingDir: context.workingDir,
                files: context.files,
                attempt: attempts,
                metadata: context.metadata
              }
            );
            warnings.push(`リトライ ${attempts}: ${lastError.message}`);
          } catch (recoveryError) {
            warnings.push(`リカバリー失敗 ${attempts}: ${recoveryError}`);
            // リカバリーが失敗してもリトライは続行
          }
        }
      }
    }

    // すべてのリトライが失敗した場合
    const executionTime = Date.now() - startTime;
    console.error(`❌ 実行完全失敗: ${context.name} (${attempts}回試行, ${executionTime}ms)`);

    // フォールバックが必要な場合
    if (options.fallbackRequired && lastError) {
      console.log(`🔄 フォールバック処理を試行中...`);
      try {
        const fallbackResult = await this.executeFallback<T>(context, lastError);
        warnings.push('フォールバック処理を使用しました');
        
        return {
          success: true,
          data: fallbackResult,
          attempts,
          executionTime,
          warnings
        };
      } catch (fallbackError) {
        warnings.push(`フォールバック失敗: ${fallbackError}`);
      }
    }

    return {
      success: false,
      error: lastError || new Error('Unknown error'),
      attempts,
      executionTime,
      warnings
    };
  }

  /**
   * タイムアウト付き実行
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Operation timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * クリティカルエラー判定
   */
  private isCriticalError(error: Error): boolean {
    const message = error.message.toLowerCase();
    const criticalPatterns = [
      'secret', 'credential', 'password', 'token',
      'permission denied', 'access denied', 'unauthorized',
      'security', 'destructive', 'dangerous'
    ];

    return criticalPatterns.some(pattern => message.includes(pattern));
  }

  /**
   * フォールバック処理
   */
  private async executeFallback<T>(
    context: { name: string; workingDir: string; files?: string[] },
    originalError: Error
  ): Promise<T> {
    const fallbackStrategies: Record<string, () => Promise<any>> = {
      'git-commit': async () => ({
        success: false,
        message: 'Git commit failed, changes staged but not committed',
        details: { fallback: true, originalError: originalError.message }
      }),
      
      'github-pr': async () => ({
        success: false,
        message: 'GitHub PR creation failed, manual creation required',
        details: { fallback: true, originalError: originalError.message }
      }),
      
      'safety-analysis': async () => ({
        safetyScore: 50,
        level: 'WARNING',
        risks: [{ 
          type: 'analysis_failed', 
          severity: 'medium', 
          description: '安全性分析が失敗しました。手動確認が必要です。' 
        }],
        recommendations: ['手動で変更内容を確認してください'],
        autoApprove: false,
        confidence: 0.1
      }),

      'commit-message': async () => ({
        title: '変更: ファイルを更新（自動生成失敗）',
        body: '自動メッセージ生成に失敗しました。詳細は変更内容をご確認ください。',
        conventional: 'chore: update files (auto-generation failed)',
        confidence: 0.1
      })
    };

    const strategy = fallbackStrategies[context.name];
    if (strategy) {
      console.log(`📋 フォールバック戦略実行: ${context.name}`);
      return await strategy();
    }

    throw new Error(`No fallback strategy available for: ${context.name}`);
  }

  /**
   * バッチ実行（複数操作の堅牢な実行）
   */
  async executeBatch<T>(
    operations: Array<{
      name: string;
      operation: () => Promise<T>;
      options?: ExecutionOptions;
      context: {
        workingDir: string;
        files?: string[];
        metadata?: Record<string, any>;
      };
    }>
  ): Promise<Array<ExecutionResult<T>>> {
    console.log(`🔄 バッチ実行開始: ${operations.length}個の操作`);
    
    const results: Array<ExecutionResult<T>> = [];
    let criticalFailure = false;

    for (const op of operations) {
      if (criticalFailure) {
        // クリティカルエラー後は残りをスキップ
        results.push({
          success: false,
          error: new Error('Skipped due to critical failure'),
          attempts: 0,
          executionTime: 0,
          warnings: ['Previous critical failure caused skip']
        });
        continue;
      }

      const result = await this.execute(
        op.operation,
        {
          name: op.name,
          ...op.context
        },
        op.options
      );

      results.push(result);

      // クリティカルエラーの場合は後続処理を停止
      if (!result.success && op.options?.critical) {
        console.error(`🛑 クリティカル操作失敗、バッチ処理を停止: ${op.name}`);
        criticalFailure = true;
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`✅ バッチ実行完了: ${successCount}/${operations.length} 成功`);

    return results;
  }

  /**
   * 状況把握とレポート
   */
  getHealthReport(): {
    status: 'healthy' | 'warning' | 'critical';
    errorStats: ReturnType<ErrorRecoverySystem['getErrorStatistics']>;
    systemHealth: ReturnType<ErrorRecoverySystem['checkSystemHealth']>;
    recommendations: string[];
  } {
    const errorStats = this.errorRecovery.getErrorStatistics();
    const systemHealth = this.errorRecovery.checkSystemHealth();
    
    const recommendations: string[] = [...systemHealth.recommendations];
    
    // 追加の推奨事項
    if (errorStats.byLevel.high > 5) {
      recommendations.push('高レベルエラーが多発しています。システム設定を確認してください。');
    }
    
    if (errorStats.avgResolutionTime > 10000) {
      recommendations.push('エラー解決時間が長くなっています。パフォーマンスを確認してください。');
    }

    return {
      status: systemHealth.status,
      errorStats,
      systemHealth,
      recommendations
    };
  }

  /**
   * 緊急停止（Emergency Stop）
   */
  emergencyStop(reason: string): void {
    console.error(`🚨 緊急停止実行: ${reason}`);
    // 実際の実装では、進行中の全操作を停止する処理を追加
    process.exit(1);
  }

  /**
   * Claude Code最適化処理
   */
  private async optimizeForClaudeCode(
    context: { name: string; workingDir: string; files?: string[]; metadata?: Record<string, any> },
    options: ExecutionOptions
  ): Promise<void> {
    // Claude Code環境での最適化
    if (process.env.CLAUDE_CODE_SESSION) {
      console.log('🔧 Claude Code環境最適化を適用中...');
      
      // プライオリティに基づくリソース調整
      if (options.priorityLevel === 'critical') {
        // クリティカル操作の場合、他の処理を一時停止
        await this.pauseNonCriticalOperations();
      }
      
      // メモリ使用量の最適化
      if (global.gc && context.metadata?.memoryIntensive) {
        console.log('🧹 メモリ最適化: ガベージコレクション実行');
        global.gc();
      }
      
      // ファイル数が多い場合のバッチ処理最適化
      if (context.files && context.files.length > 50) {
        console.log(`📦 大量ファイル処理最適化: ${context.files.length}ファイル`);
        context.metadata = {
          ...context.metadata,
          batchProcessing: true,
          chunkSize: Math.min(20, Math.ceil(context.files.length / 4))
        };
      }
    }
  }

  /**
   * 最適タイムアウト計算
   */
  private calculateOptimalTimeout(operationName: string, options: ExecutionOptions): number {
    const baseTimeouts: Record<string, number> = {
      'safety-analysis': 45000,
      'commit-message-generation': 30000,
      'pr-management': 60000,
      'github-operations': 90000,
      'git-operations': 30000,
      'file-analysis': 25000
    };

    let baseTimeout = baseTimeouts[operationName] || 30000;

    // プライオリティに基づく調整
    switch (options.priorityLevel) {
      case 'critical':
        baseTimeout *= 2; // クリティカル操作は十分な時間を確保
        break;
      case 'high':
        baseTimeout *= 1.5;
        break;
      case 'low':
        baseTimeout *= 0.7; // 低優先度は短縮
        break;
    }

    // 履歴に基づく適応的調整
    if (options.adaptiveTimeout) {
      const avgTime = this.getAverageExecutionTime(operationName);
      if (avgTime > 0) {
        baseTimeout = Math.max(baseTimeout, avgTime * 1.8); // 平均時間の1.8倍をタイムアウトに
      }
    }

    // Claude Code環境での調整
    if (options.claudeCodeOptimized && process.env.CLAUDE_CODE_SESSION) {
      baseTimeout *= 1.3; // Claude Code環境では余裕をもたせる
    }

    return Math.min(baseTimeout, 300000); // 最大5分
  }

  /**
   * リトライ時のタイムアウト調整
   */
  private adjustTimeoutForRetry(currentTimeout: number, attempt: number, operationName: string): number {
    // リトライ時は段階的にタイムアウトを延長
    const multiplier = 1 + (attempt - 1) * 0.5; // 1回目: 1.0x, 2回目: 1.5x, 3回目: 2.0x
    const adjustedTimeout = Math.floor(currentTimeout * multiplier);
    
    console.log(`⏱️ タイムアウト調整 ${operationName}: ${currentTimeout}ms → ${adjustedTimeout}ms (試行${attempt}回目)`);
    
    return Math.min(adjustedTimeout, 300000); // 最大5分
  }

  /**
   * 実行時間記録
   */
  private recordExecutionTime(operationName: string, executionTime: number): void {
    if (!this.executionHistory.has(operationName)) {
      this.executionHistory.set(operationName, []);
    }
    
    const history = this.executionHistory.get(operationName)!;
    history.push(executionTime);
    
    // 直近20回の記録のみ保持
    if (history.length > 20) {
      history.shift();
    }
  }

  /**
   * 平均実行時間取得
   */
  private getAverageExecutionTime(operationName: string): number {
    const history = this.executionHistory.get(operationName);
    if (!history || history.length === 0) {
      return 0;
    }
    
    const sum = history.reduce((acc, time) => acc + time, 0);
    return Math.floor(sum / history.length);
  }

  /**
   * 非クリティカル操作の一時停止
   */
  private async pauseNonCriticalOperations(): Promise<void> {
    // 実装例: ファイル監視の一時停止、定期処理の延期など
    console.log('⏸️ 非クリティカル操作を一時停止');
    // 実際の実装では、システム全体の状態管理が必要
  }

  /**
   * パフォーマンス統計取得
   */
  getPerformanceStats(): {
    operations: Record<string, {
      averageTime: number;
      totalExecutions: number;
      successRate: number;
    }>;
    systemHealth: 'optimal' | 'good' | 'warning' | 'critical';
  } {
    const operations: Record<string, any> = {};
    
    for (const [operationName, times] of this.executionHistory.entries()) {
      operations[operationName] = {
        averageTime: this.getAverageExecutionTime(operationName),
        totalExecutions: times.length,
        successRate: 1.0 // 成功した実行のみ記録されるため100%
      };
    }
    
    // システム健全性判定
    const avgTimes = Object.values(operations).map((op: any) => op.averageTime);
    const maxAvgTime = Math.max(...avgTimes, 0);
    
    let systemHealth: 'optimal' | 'good' | 'warning' | 'critical' = 'optimal';
    if (maxAvgTime > 60000) systemHealth = 'critical';
    else if (maxAvgTime > 30000) systemHealth = 'warning';
    else if (maxAvgTime > 15000) systemHealth = 'good';
    
    return {
      operations,
      systemHealth
    };
  }

  /**
   * メンテナンス関数
   */
  async performMaintenance(): Promise<{
    errorsCleared: number;
    status: string;
    performanceOptimized: boolean;
  }> {
    console.log('🧹 定期メンテナンス実行中...');
    
    const errorsCleared = this.errorRecovery.clearOldErrors(24); // 24時間前のエラーをクリア
    const healthReport = this.getHealthReport();
    
    // パフォーマンス履歴のクリーンアップ
    let performanceOptimized = false;
    for (const [operationName, times] of this.executionHistory.entries()) {
      if (times.length > 50) {
        // 古い履歴を削除
        times.splice(0, times.length - 20);
        performanceOptimized = true;
      }
    }
    
    console.log(`✅ メンテナンス完了: ${errorsCleared}個のエラーをクリア, パフォーマンス最適化: ${performanceOptimized}`);
    
    return {
      errorsCleared,
      status: healthReport.status,
      performanceOptimized
    };
  }
}