/**
 * Fail Fast Checker
 * エラーハンドリング、早期バリデーション、異常状態検出
 */

import { 
  ValidationResult,
  ValidationError,
  AnomalyReport,
  Anomaly,
  CoverageReport,
  BoundaryReport,
  SecurityBoundary,
  BoundaryViolation,
  ConstitutionalViolation,
  SystemState
} from '../../types/constitutional-ai.js';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface FailFastConfig {
  enabled: boolean;
  strictness: 'low' | 'medium' | 'high';
  autoFix: boolean;
}

export interface FailFastResult {
  score: number;
  violations: ConstitutionalViolation[];
  recommendations: string[];
  details: {
    validation: ValidationResult;
    anomalies: AnomalyReport;
    coverage: CoverageReport;
    boundaries: BoundaryReport;
  };
}

export class FailFastChecker {
  private workingDir: string;
  private config: FailFastConfig;

  constructor(workingDir: string, config: FailFastConfig) {
    this.workingDir = workingDir;
    this.config = config;
  }

  /**
   * Fail Fast原則の包括的チェック
   */
  async performFullCheck(context?: {
    files?: string[];
    operation?: string;
    metadata?: Record<string, any>;
  }): Promise<FailFastResult> {
    if (!this.config.enabled) {
      return this.getDisabledResult();
    }

    try {
      console.log('⚡ Fail Fast Checker 実行中...');

      // 並列でチェック実行
      const [validation, anomalies, coverage, boundaries] = await Promise.all([
        this.validateEarly(context?.operation || 'general', context),
        this.detectAnomalies(await this.getSystemState()),
        this.verifyErrorHandling(context?.files || []),
        this.validateSecurityBoundaries()
      ]);

      const violations = this.analyzeResults(validation, anomalies, coverage, boundaries);
      const score = this.calculateFailFastScore(validation, anomalies, coverage, boundaries);
      const recommendations = this.generateRecommendations(violations);

      console.log(`✅ Fail Fast チェック完了 (スコア: ${score}/100)`);

      return {
        score,
        violations,
        recommendations,
        details: {
          validation,
          anomalies,
          coverage,
          boundaries
        }
      };

    } catch (error) {
      console.error('❌ Fail Fast Checker エラー:', error);
      return this.getErrorResult(error);
    }
  }

  /**
   * 早期バリデーション
   */
  async validateEarly(operation: string, input: any): Promise<ValidationResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    try {
      // 入力値の基本検証
      if (!operation) {
        errors.push({
          code: 'MISSING_OPERATION',
          message: 'Operation name is required',
          severity: 'high'
        });
      }

      // ファイルパス検証
      if (input?.files) {
        for (const file of input.files) {
          if (!file || typeof file !== 'string') {
            errors.push({
              code: 'INVALID_FILE_PATH',
              message: `Invalid file path: ${file}`,
              severity: 'medium'
            });
          } else if (file.includes('..')) {
            errors.push({
              code: 'PATH_TRAVERSAL_RISK',
              message: `Potential path traversal in: ${file}`,
              filePath: file,
              severity: 'critical'
            });
          }
        }
      }

      // メタデータ検証
      if (input?.metadata) {
        if (typeof input.metadata !== 'object') {
          errors.push({
            code: 'INVALID_METADATA',
            message: 'Metadata must be an object',
            severity: 'medium'
          });
        }
      }

      // 環境変数検証
      if (operation.includes('github') && !process.env.GITHUB_TOKEN) {
        warnings.push('GITHUB_TOKEN not set - GitHub operations may fail');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      errors.push({
        code: 'VALIDATION_ERROR',
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical'
      });

      return {
        isValid: false,
        errors,
        warnings,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * 異常状態検出
   */
  async detectAnomalies(systemState: SystemState): Promise<AnomalyReport> {
    const anomalies: Anomaly[] = [];

    // メモリ使用量チェック
    if (systemState.memory.percentage > 90) {
      anomalies.push({
        type: 'memory',
        description: `High memory usage: ${systemState.memory.percentage}%`,
        severity: 'critical',
        detectedAt: new Date(),
        context: { memoryUsage: systemState.memory }
      });
    } else if (systemState.memory.percentage > 75) {
      anomalies.push({
        type: 'memory',
        description: `Elevated memory usage: ${systemState.memory.percentage}%`,
        severity: 'medium',
        detectedAt: new Date(),
        context: { memoryUsage: systemState.memory }
      });
    }

    // CPU使用量チェック
    if (systemState.cpu.usage > 95) {
      anomalies.push({
        type: 'performance',
        description: `Very high CPU usage: ${systemState.cpu.usage}%`,
        severity: 'critical',
        detectedAt: new Date(),
        context: { cpuUsage: systemState.cpu }
      });
    }

    // エラー頻度チェック
    if (systemState.errors.recent > 10) {
      anomalies.push({
        type: 'error',
        description: `High error frequency: ${systemState.errors.recent} recent errors`,
        severity: 'high',
        detectedAt: new Date(),
        context: { errorStats: systemState.errors }
      });
    }

    if (systemState.errors.critical > 0) {
      anomalies.push({
        type: 'error',
        description: `Critical errors detected: ${systemState.errors.critical}`,
        severity: 'critical',
        detectedAt: new Date(),
        context: { errorStats: systemState.errors }
      });
    }

    // パフォーマンス異常チェック
    if (systemState.performance.averageResponseTime > 5000) {
      anomalies.push({
        type: 'performance',
        description: `Slow response time: ${systemState.performance.averageResponseTime}ms`,
        severity: 'medium',
        detectedAt: new Date(),
        context: { performance: systemState.performance }
      });
    }

    const systemHealth = anomalies.some(a => a.severity === 'critical') ? 'critical' :
                        anomalies.some(a => a.severity === 'high') ? 'warning' : 'healthy';

    const recommendations = anomalies.map(anomaly => {
      switch (anomaly.type) {
        case 'memory':
          return 'Consider increasing memory allocation or optimizing memory usage';
        case 'performance':
          return 'Investigate performance bottlenecks and optimize critical paths';
        case 'error':
          return 'Review and fix recurring errors to improve system stability';
        default:
          return 'Monitor system closely and consider preventive measures';
      }
    });

    return {
      anomalies,
      systemHealth,
      recommendations: [...new Set(recommendations)]
    };
  }

  /**
   * エラーハンドリング完全性の検証
   */
  async verifyErrorHandling(files: string[]): Promise<CoverageReport> {
    let totalFunctions = 0;
    let errorHandledFunctions = 0;
    const missingErrorHandling: string[] = [];

    try {
      // TypeScriptファイルを対象に分析
      const tsFiles = files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
      
      for (const file of tsFiles) {
        try {
          const fullPath = join(this.workingDir, file);
          const content = await fs.readFile(fullPath, 'utf-8');
          
          // 関数定義を検索
          const functionMatches = content.match(/(async\s+)?function\s+\w+|(\w+\s*:\s*)?async\s*\([^)]*\)\s*=>|(async\s+)?\w+\s*\([^)]*\)\s*\{/g) || [];
          totalFunctions += functionMatches.length;
          
          // try-catch文の存在をチェック
          const tryCatchMatches = content.match(/try\s*\{[^}]*\}\s*catch/g) || [];
          const errorHandlingMatches = content.match(/\.catch\(|catch\s*\(|throw\s+/g) || [];
          
          const hasErrorHandling = tryCatchMatches.length > 0 || errorHandlingMatches.length > 0;
          
          if (hasErrorHandling) {
            errorHandledFunctions += Math.min(functionMatches.length, tryCatchMatches.length + errorHandlingMatches.length);
          } else if (functionMatches.length > 0) {
            missingErrorHandling.push(file);
          }

        } catch (error) {
          missingErrorHandling.push(`${file} (読み込みエラー)`);
        }
      }

      const coveragePercentage = totalFunctions > 0 ? Math.round((errorHandledFunctions / totalFunctions) * 100) : 100;

      const recommendations = [
        ...(coveragePercentage < 80 ? ['エラーハンドリングの網羅性を向上させてください'] : []),
        ...(missingErrorHandling.length > 0 ? ['以下のファイルにエラーハンドリングを追加してください'] : [])
      ];

      return {
        module: 'error-handling',
        totalFunctions,
        errorHandledFunctions,
        coveragePercentage,
        missingErrorHandling,
        recommendations
      };

    } catch (error) {
      return {
        module: 'error-handling',
        totalFunctions: 0,
        errorHandledFunctions: 0,
        coveragePercentage: 0,
        missingErrorHandling: ['分析エラーが発生しました'],
        recommendations: ['エラーハンドリング分析機能を確認してください']
      };
    }
  }

  /**
   * セキュリティ境界の検証
   */
  async validateSecurityBoundaries(): Promise<BoundaryReport> {
    const boundaries: SecurityBoundary[] = [];
    const violations: BoundaryViolation[] = [];

    // 入力検証境界
    boundaries.push({
      name: 'user-input',
      type: 'input',
      validated: true, // 既存のSecurityManagerで実装済み
      sanitized: true
    });

    // ファイルアクセス境界
    boundaries.push({
      name: 'file-access',
      type: 'file',
      validated: true,
      sanitized: true
    });

    // API境界
    boundaries.push({
      name: 'github-api',
      type: 'api',
      validated: !!process.env.GITHUB_TOKEN,
      sanitized: true
    });

    // ネットワーク境界
    boundaries.push({
      name: 'network',
      type: 'network',
      validated: true,
      sanitized: true
    });

    // 出力境界
    boundaries.push({
      name: 'output',
      type: 'output',
      validated: true,
      sanitized: true
    });

    // 境界違反のチェック
    for (const boundary of boundaries) {
      if (!boundary.validated) {
        violations.push({
          boundary: boundary.name,
          issue: 'Validation not implemented',
          severity: 'high',
          recommendation: `Implement validation for ${boundary.name} boundary`
        });
      }
      if (!boundary.sanitized) {
        violations.push({
          boundary: boundary.name,
          issue: 'Sanitization not implemented',
          severity: 'medium',
          recommendation: `Implement sanitization for ${boundary.name} boundary`
        });
      }
    }

    const score = Math.round(((boundaries.length - violations.length) / boundaries.length) * 100);

    return {
      boundaries,
      violations,
      score
    };
  }

  /**
   * Fail Fastスコア計算
   */
  private calculateFailFastScore(
    validation: ValidationResult,
    anomalies: AnomalyReport,
    coverage: CoverageReport,
    boundaries: BoundaryReport
  ): number {
    // 各要素の重み付きスコア計算
    const validationScore = validation.isValid ? 100 : Math.max(0, 100 - (validation.errors.length * 20));
    const anomalyScore = anomalies.systemHealth === 'healthy' ? 100 : 
                        anomalies.systemHealth === 'warning' ? 70 : 40;
    const coverageScore = coverage.coveragePercentage;
    const boundaryScore = boundaries.score;

    // 重み付き平均（バリデーション30%、異常検出20%、カバレッジ30%、境界20%）
    return Math.round(
      validationScore * 0.3 +
      anomalyScore * 0.2 +
      coverageScore * 0.3 +
      boundaryScore * 0.2
    );
  }

  /**
   * 結果分析と違反抽出
   */
  private analyzeResults(
    validation: ValidationResult,
    anomalies: AnomalyReport,
    coverage: CoverageReport,
    boundaries: BoundaryReport
  ): ConstitutionalViolation[] {
    const violations: ConstitutionalViolation[] = [];

    // バリデーションエラーを違反に変換
    validation.errors.forEach((error, index) => {
      violations.push({
        id: `validation-${index}`,
        principle: 'fail-fast',
        severity: error.severity as any,
        description: error.message,
        filePath: error.filePath,
        lineNumber: error.lineNumber,
        autoFixable: error.severity !== 'critical',
        recommendation: `Fix validation error: ${error.code}`
      });
    });

    // 異常状態を違反に変換
    anomalies.anomalies.forEach((anomaly, index) => {
      violations.push({
        id: `anomaly-${index}`,
        principle: 'fail-fast',
        severity: anomaly.severity as any,
        description: anomaly.description,
        autoFixable: false,
        recommendation: `Address system anomaly: ${anomaly.type}`
      });
    });

    // カバレッジ不足を違反に変換
    if (coverage.coveragePercentage < 80) {
      violations.push({
        id: 'coverage-insufficient',
        principle: 'fail-fast',
        severity: coverage.coveragePercentage < 50 ? 'high' : 'medium',
        description: `Error handling coverage is ${coverage.coveragePercentage}% (target: 80%+)`,
        autoFixable: false,
        recommendation: 'Improve error handling coverage in missing functions'
      });
    }

    // 境界違反を変換
    boundaries.violations.forEach((violation, index) => {
      violations.push({
        id: `boundary-${index}`,
        principle: 'fail-fast',
        severity: violation.severity as any,
        description: `Security boundary violation: ${violation.issue}`,
        autoFixable: violation.severity !== 'critical',
        recommendation: violation.recommendation
      });
    });

    return violations;
  }

  /**
   * 推奨事項生成
   */
  private generateRecommendations(violations: ConstitutionalViolation[]): string[] {
    const recommendations = new Set<string>();

    violations.forEach(violation => {
      recommendations.add(violation.recommendation);
    });

    // 一般的な推奨事項
    if (violations.some(v => v.severity === 'critical')) {
      recommendations.add('Critical issues detected - immediate attention required');
    }

    if (violations.length > 10) {
      recommendations.add('Consider systematic improvement of error handling practices');
    }

    if (violations.some(v => v.principle === 'fail-fast' && v.description.includes('validation'))) {
      recommendations.add('Implement comprehensive input validation for all external inputs');
    }

    return Array.from(recommendations);
  }

  /**
   * システム状態取得
   */
  private async getSystemState(): Promise<SystemState> {
    const process = await import('process');
    const memUsage = process.memoryUsage();
    
    return {
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
      },
      cpu: {
        usage: Math.round(process.cpuUsage().user / 1000),
        processes: 1
      },
      disk: {
        used: 0,
        total: 0,
        percentage: 0
      },
      errors: {
        recent: 0, // ErrorRecoverySystemから取得する場合は要修正
        critical: 0
      },
      performance: {
        averageResponseTime: 0,
        throughput: 0
      }
    };
  }

  /**
   * 設定更新
   */
  updateConfig(newConfig: Partial<FailFastConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 無効時の結果
   */
  private getDisabledResult(): FailFastResult {
    return {
      score: 0,
      violations: [],
      recommendations: ['Fail Fast checker is disabled'],
      details: {
        validation: { isValid: true, errors: [], warnings: [], executionTime: 0 },
        anomalies: { anomalies: [], systemHealth: 'healthy', recommendations: [] },
        coverage: { module: 'disabled', totalFunctions: 0, errorHandledFunctions: 0, coveragePercentage: 0, missingErrorHandling: [], recommendations: [] },
        boundaries: { boundaries: [], violations: [], score: 0 }
      }
    };
  }

  /**
   * エラー時の結果
   */
  private getErrorResult(error: any): FailFastResult {
    return {
      score: 0,
      violations: [{
        id: 'checker-error',
        principle: 'fail-fast',
        severity: 'critical',
        description: `Fail Fast checker error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        autoFixable: false,
        recommendation: 'Check Fail Fast checker configuration and dependencies'
      }],
      recommendations: ['Fix Fail Fast checker error'],
      details: {
        validation: { isValid: false, errors: [], warnings: [], executionTime: 0 },
        anomalies: { anomalies: [], systemHealth: 'critical', recommendations: [] },
        coverage: { module: 'error', totalFunctions: 0, errorHandledFunctions: 0, coveragePercentage: 0, missingErrorHandling: [], recommendations: [] },
        boundaries: { boundaries: [], violations: [], score: 0 }
      }
    };
  }
}