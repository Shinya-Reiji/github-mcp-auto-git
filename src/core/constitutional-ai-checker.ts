/**
 * Constitutional AI Checker Core
 * 3原則（Fail Fast, Be Lazy, TypeScript First）チェック機能の統合管理
 */

import { 
  ConstitutionalAIReport, 
  ConstitutionalViolation, 
  ConstitutionalAIConfig,
  SystemState,
  HealthStatus
} from '../types/constitutional-ai.js';
import { FailFastChecker } from './constitutional/fail-fast-checker.js';
import { BeLazyChecker } from './constitutional/be-lazy-checker.js';
import { TypeScriptFirstChecker } from './constitutional/typescript-first-checker.js';
import { ErrorRecoverySystem } from './error-recovery.js';
import { ResilientExecutor } from './resilient-executor.js';

export class ConstitutionalAIChecker {
  private failFastChecker: FailFastChecker;
  private beLazyChecker: BeLazyChecker;
  private typeScriptFirstChecker: TypeScriptFirstChecker;
  private errorRecovery: ErrorRecoverySystem;
  private resilientExecutor: ResilientExecutor;
  private config: ConstitutionalAIConfig;
  private workingDir: string;

  constructor(workingDir: string = process.cwd(), config?: Partial<ConstitutionalAIConfig>) {
    this.workingDir = workingDir;
    this.config = this.createDefaultConfig(config);
    
    // 依存システム初期化
    this.errorRecovery = new ErrorRecoverySystem();
    this.resilientExecutor = new ResilientExecutor();
    
    // 各チェッカー初期化
    this.failFastChecker = new FailFastChecker(this.workingDir, this.config.principles.failFast);
    this.beLazyChecker = new BeLazyChecker(this.workingDir, this.config.principles.beLazy);
    this.typeScriptFirstChecker = new TypeScriptFirstChecker(this.workingDir, this.config.principles.typeScriptFirst);
  }

  /**
   * Constitutional AI原則の包括的チェック実行
   */
  async runComprehensiveCheck(context?: {
    files?: string[];
    operation?: string;
    metadata?: Record<string, any>;
  }): Promise<ConstitutionalAIReport> {
    const startTime = Date.now();
    
    try {
      console.log('🏛️ Constitutional AI Checker 実行開始...');
      
      // 各原則チェックを並列実行
      const checkResults = await this.resilientExecutor.executeBatch([
        {
          name: 'fail-fast-check',
          operation: () => this.failFastChecker.performFullCheck(context) as Promise<any>,
          context: {
            workingDir: this.workingDir,
            files: context?.files,
            metadata: { principle: 'fail-fast', ...context?.metadata }
          },
          options: {
            maxRetries: 2,
            timeoutMs: 30000,
            critical: false,
            fallbackRequired: true,
            claudeCodeOptimized: true,
            priorityLevel: 'high'
          }
        },
        {
          name: 'be-lazy-check',
          operation: () => this.beLazyChecker.performEfficiencyAudit(context) as Promise<any>,
          context: {
            workingDir: this.workingDir,
            files: context?.files,
            metadata: { principle: 'be-lazy', ...context?.metadata }
          },
          options: {
            maxRetries: 2,
            timeoutMs: 45000,
            critical: false,
            fallbackRequired: true,
            claudeCodeOptimized: true,
            priorityLevel: 'medium'
          }
        },
        {
          name: 'typescript-first-check',
          operation: () => this.typeScriptFirstChecker.performTypeAnalysis(context) as Promise<any>,
          context: {
            workingDir: this.workingDir,
            files: context?.files,
            metadata: { principle: 'typescript-first', ...context?.metadata }
          },
          options: {
            maxRetries: 2,
            timeoutMs: 35000,
            critical: false,
            fallbackRequired: true,
            claudeCodeOptimized: true,
            priorityLevel: 'high'
          }
        }
      ]);

      // 結果統合
      const report = this.generateConstitutionalReport(checkResults, startTime);
      
      // リアルタイム監視が有効な場合
      if (this.config.reporting.realTimeMonitoring) {
        await this.updateRealtimeMetrics(report);
      }
      
      console.log(`✅ Constitutional AI Checker 完了 (スコア: ${report.overallScore}/100, ${report.executionTime}ms)`);
      
      return report;

    } catch (error) {
      console.error('❌ Constitutional AI Checker 実行エラー:', error);
      
      // エラー発生時のフォールバックレポート
      return {
        overallScore: 0,
        principleScores: {
          failFast: 0,
          beLazy: 0,
          typeScriptFirst: 0
        },
        violations: [{
          id: `error-${Date.now()}`,
          principle: 'fail-fast',
          severity: 'critical',
          description: `Constitutional AI Checker実行エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
          autoFixable: false,
          recommendation: 'システム管理者に連絡してください'
        }],
        recommendations: ['Constitutional AI Checkerの設定を確認してください'],
        autoFixAvailable: false,
        executionTime: Date.now() - startTime,
        timestamp: new Date()
      };
    }
  }

  /**
   * 特定原則のみチェック実行
   */
  async runPrincipleCheck(
    principle: 'fail-fast' | 'be-lazy' | 'typescript-first',
    context?: any
  ): Promise<ConstitutionalAIReport> {
    const startTime = Date.now();
    
    let principleScore = 0;
    let violations: ConstitutionalViolation[] = [];
    let recommendations: string[] = [];

    try {
      switch (principle) {
        case 'fail-fast':
          const failFastResult = await this.failFastChecker.performFullCheck(context);
          principleScore = failFastResult.score;
          violations = failFastResult.violations;
          recommendations = failFastResult.recommendations;
          break;
          
        case 'be-lazy':
          const beLazyResult = await this.beLazyChecker.performEfficiencyAudit(context);
          principleScore = beLazyResult.score;
          violations = beLazyResult.violations;
          recommendations = beLazyResult.recommendations;
          break;
          
        case 'typescript-first':
          const typeScriptResult = await this.typeScriptFirstChecker.performTypeAnalysis(context);
          principleScore = typeScriptResult.score;
          violations = typeScriptResult.violations;
          recommendations = typeScriptResult.recommendations;
          break;
      }

      return {
        overallScore: principleScore,
        principleScores: {
          failFast: principle === 'fail-fast' ? principleScore : 0,
          beLazy: principle === 'be-lazy' ? principleScore : 0,
          typeScriptFirst: principle === 'typescript-first' ? principleScore : 0
        },
        violations,
        recommendations,
        autoFixAvailable: violations.some(v => v.autoFixable),
        executionTime: Date.now() - startTime,
        timestamp: new Date()
      };

    } catch (error) {
      console.error(`❌ ${principle} チェック実行エラー:`, error);
      throw error;
    }
  }

  /**
   * システム健全性チェック
   */
  async checkSystemHealth(): Promise<HealthStatus> {
    try {
      const systemState = await this.getSystemState();
      const performanceStats = this.resilientExecutor.getPerformanceStats();
      
      const componentHealths = [
        {
          component: 'fail-fast-checker',
          status: (this.config.principles.failFast.enabled ? 'healthy' : 'warning') as 'healthy' | 'warning' | 'critical',
          metrics: { enabled: this.config.principles.failFast.enabled ? 1 : 0, health: 100 },
          issues: this.config.principles.failFast.enabled ? [] : ['Fail Fast checker is disabled']
        },
        {
          component: 'be-lazy-checker',
          status: (this.config.principles.beLazy.enabled ? 'healthy' : 'warning') as 'healthy' | 'warning' | 'critical',
          metrics: { enabled: this.config.principles.beLazy.enabled ? 1 : 0, health: 100 },
          issues: this.config.principles.beLazy.enabled ? [] : ['Be Lazy checker is disabled']
        },
        {
          component: 'typescript-first-checker',
          status: (this.config.principles.typeScriptFirst.enabled ? 'healthy' : 'warning') as 'healthy' | 'warning' | 'critical',
          metrics: { enabled: this.config.principles.typeScriptFirst.enabled ? 1 : 0, health: 100 },
          issues: this.config.principles.typeScriptFirst.enabled ? [] : ['TypeScript First checker is disabled']
        },
        {
          component: 'performance',
          status: (performanceStats.systemHealth === 'critical' ? 'critical' : 
                  performanceStats.systemHealth === 'warning' ? 'warning' : 'healthy') as 'healthy' | 'warning' | 'critical',
          metrics: { 
            health: performanceStats.systemHealth === 'optimal' ? 100 : 
                   performanceStats.systemHealth === 'good' ? 80 :
                   performanceStats.systemHealth === 'warning' ? 60 : 40,
            enabled: 1
          },
          issues: performanceStats.systemHealth !== 'optimal' ? 
                  [`Performance is ${performanceStats.systemHealth}`] : []
        }
      ];

      const overallStatus = componentHealths.some(c => c.status === 'critical') ? 'critical' :
                          componentHealths.some(c => c.status === 'warning') ? 'warning' : 'healthy';

      const recommendations = [
        ...componentHealths.flatMap(c => c.issues.map(issue => `${c.component}: ${issue}`)),
        ...(systemState.memory.percentage > 80 ? ['High memory usage detected'] : []),
        ...(systemState.cpu.usage > 80 ? ['High CPU usage detected'] : [])
      ];

      return {
        overall: overallStatus,
        components: componentHealths,
        recommendations,
        lastChecked: new Date()
      };

    } catch (error) {
      console.error('❌ システム健全性チェックエラー:', error);
      return {
        overall: 'critical',
        components: [],
        recommendations: ['System health check failed'],
        lastChecked: new Date()
      };
    }
  }

  /**
   * 設定更新
   */
  updateConfig(newConfig: Partial<ConstitutionalAIConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // チェッカーの設定も更新
    if (newConfig.principles?.failFast) {
      this.failFastChecker.updateConfig(newConfig.principles.failFast);
    }
    if (newConfig.principles?.beLazy) {
      this.beLazyChecker.updateConfig(newConfig.principles.beLazy);
    }
    if (newConfig.principles?.typeScriptFirst) {
      this.typeScriptFirstChecker.updateConfig(newConfig.principles.typeScriptFirst);
    }
  }

  /**
   * 現在の設定取得
   */
  getConfig(): ConstitutionalAIConfig {
    return { ...this.config };
  }

  /**
   * デフォルト設定作成
   */
  private createDefaultConfig(userConfig?: Partial<ConstitutionalAIConfig>): ConstitutionalAIConfig {
    const defaultConfig: ConstitutionalAIConfig = {
      enabled: true,
      principles: {
        failFast: {
          enabled: true,
          strictness: 'medium',
          autoFix: false
        },
        beLazy: {
          enabled: true,
          performanceThreshold: 1000,
          duplicateThreshold: 3,
          autoOptimize: false
        },
        typeScriptFirst: {
          enabled: true,
          strictMode: true,
          enforceExplicitTypes: false,
          autoInference: true
        }
      },
      reporting: {
        detailedReports: true,
        realTimeMonitoring: false,
        dashboard: false
      },
      integration: {
        gitHooks: false,
        cicd: false,
        vscode: false
      }
    };

    return userConfig ? { ...defaultConfig, ...userConfig } : defaultConfig;
  }

  /**
   * チェック結果からConstitutional AIレポート生成
   */
  private generateConstitutionalReport(
    checkResults: any[],
    startTime: number
  ): ConstitutionalAIReport {
    const failFastResult = checkResults[0]?.data || { score: 0, violations: [], recommendations: [] };
    const beLazyResult = checkResults[1]?.data || { score: 0, violations: [], recommendations: [] };
    const typeScriptResult = checkResults[2]?.data || { score: 0, violations: [], recommendations: [] };

    const principleScores = {
      failFast: failFastResult.score || 0,
      beLazy: beLazyResult.score || 0,
      typeScriptFirst: typeScriptResult.score || 0
    };

    // 加重平均でOverall Scoreを計算（Fail FastとTypeScript Firstを重視）
    const overallScore = Math.round(
      (principleScores.failFast * 0.4 + 
       principleScores.beLazy * 0.2 + 
       principleScores.typeScriptFirst * 0.4)
    );

    const violations: ConstitutionalViolation[] = [
      ...(failFastResult.violations || []),
      ...(beLazyResult.violations || []),
      ...(typeScriptResult.violations || [])
    ];

    const recommendations: string[] = [
      ...(failFastResult.recommendations || []),
      ...(beLazyResult.recommendations || []),
      ...(typeScriptResult.recommendations || [])
    ];

    return {
      overallScore,
      principleScores,
      violations,
      recommendations: [...new Set(recommendations)], // 重複削除
      autoFixAvailable: violations.some(v => v.autoFixable),
      executionTime: Date.now() - startTime,
      timestamp: new Date()
    };
  }

  /**
   * システム状態取得
   */
  private async getSystemState(): Promise<SystemState> {
    const process = await import('process');
    const memUsage = process.memoryUsage();
    
    return {
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
      },
      cpu: {
        usage: Math.round(process.cpuUsage().user / 1000), // 簡易的なCPU使用率
        processes: 1 // Node.js process
      },
      disk: {
        used: 0, // 実装が複雑なため省略
        total: 0,
        percentage: 0
      },
      errors: {
        recent: this.errorRecovery.getErrorStatistics().total,
        critical: this.errorRecovery.getErrorStatistics().byLevel.critical
      },
      performance: {
        averageResponseTime: Object.values(this.resilientExecutor.getPerformanceStats().operations)
          .reduce((avg, op: any) => avg + op.averageTime, 0) / 
          Object.keys(this.resilientExecutor.getPerformanceStats().operations).length || 0,
        throughput: Object.values(this.resilientExecutor.getPerformanceStats().operations)
          .reduce((total, op: any) => total + op.totalExecutions, 0)
      }
    };
  }

  /**
   * リアルタイムメトリクス更新
   */
  private async updateRealtimeMetrics(report: ConstitutionalAIReport): Promise<void> {
    // リアルタイム監視機能の実装
    // 実際の実装では、WebSocket、イベントストリーム、ダッシュボード更新など
    console.log('📊 リアルタイムメトリクス更新:', {
      overallScore: report.overallScore,
      violations: report.violations.length,
      timestamp: report.timestamp
    });
  }
}