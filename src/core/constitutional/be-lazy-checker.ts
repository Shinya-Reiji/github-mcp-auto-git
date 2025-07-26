/**
 * Be Lazy Checker
 * 効率性確認、重複排除、自動化機会検出
 */

import {
  PerformanceReport,
  Bottleneck,
  DuplicationReport,
  DuplicateOperation,
  AutomationReport,
  AutomationOpportunity,
  CacheEfficiencyReport,
  CacheMissOpportunity,
  ResourceOptimizationReport,
  ResourceUsage,
  ResourceSavings,
  ConstitutionalViolation
} from '../../types/constitutional-ai.js';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface BeLazyConfig {
  enabled: boolean;
  performanceThreshold: number; // ms
  duplicateThreshold: number;
  autoOptimize: boolean;
}

export interface BeLazyResult {
  score: number;
  violations: ConstitutionalViolation[];
  recommendations: string[];
  details: {
    performance: PerformanceReport;
    duplication: DuplicationReport;
    automation: AutomationReport;
    cache: CacheEfficiencyReport;
    resource: ResourceOptimizationReport;
  };
}

export class BeLazyChecker {
  private workingDir: string;
  private config: BeLazyConfig;
  private performanceHistory: Map<string, number[]> = new Map();
  private operationPatterns: Map<string, number> = new Map();

  constructor(workingDir: string, config: BeLazyConfig) {
    this.workingDir = workingDir;
    this.config = config;
  }

  /**
   * Be Lazy原則の効率性監査
   */
  async performEfficiencyAudit(context?: {
    files?: string[];
    operation?: string;
    metadata?: Record<string, any>;
  }): Promise<BeLazyResult> {
    if (!this.config.enabled) {
      return this.getDisabledResult();
    }

    try {
      console.log('🦥 Be Lazy Checker 実行中...');

      // 各分析を並列実行
      const [performance, duplication, automation, cache, resource] = await Promise.all([
        this.analyzePerformance(context?.operation || 'general'),
        this.detectDuplicateOperations(context?.files || []),
        this.identifyAutomationOpportunities(context),
        this.evaluateCaching(),
        this.optimizeResourceUsage()
      ]);

      const violations = this.analyzeEfficiencyResults(performance, duplication, automation, cache, resource);
      const score = this.calculateEfficiencyScore(performance, duplication, automation, cache, resource);
      const recommendations = this.generateEfficiencyRecommendations(violations);

      console.log(`✅ Be Lazy チェック完了 (スコア: ${score}/100)`);

      return {
        score,
        violations,
        recommendations,
        details: {
          performance,
          duplication,
          automation,
          cache,
          resource
        }
      };

    } catch (error) {
      console.error('❌ Be Lazy Checker エラー:', error);
      return this.getErrorResult(error);
    }
  }

  /**
   * パフォーマンス分析
   */
  async analyzePerformance(operation: string): Promise<PerformanceReport> {
    try {
      // パフォーマンス履歴の分析
      const history = this.performanceHistory.get(operation) || [];
      const averageExecutionTime = history.length > 0 ? 
        history.reduce((sum, time) => sum + time, 0) / history.length : 0;

      // メモリ使用量取得
      const memUsage = process.memoryUsage();
      const memoryUsage = Math.round(memUsage.heapUsed / 1024 / 1024); // MB

      // CPU使用量（簡易計算）
      const cpuUsage = Math.round(process.cpuUsage().user / 1000);

      // ボトルネックの検出
      const bottlenecks: Bottleneck[] = [];

      if (averageExecutionTime > this.config.performanceThreshold) {
        bottlenecks.push({
          location: operation,
          type: 'cpu',
          impact: averageExecutionTime > this.config.performanceThreshold * 2 ? 'high' : 'medium',
          description: `Slow execution time: ${averageExecutionTime}ms (threshold: ${this.config.performanceThreshold}ms)`,
          solution: 'Optimize algorithm or use caching'
        });
      }

      if (memoryUsage > 100) {
        bottlenecks.push({
          location: operation,
          type: 'memory',
          impact: memoryUsage > 200 ? 'high' : 'medium',
          description: `High memory usage: ${memoryUsage}MB`,
          solution: 'Optimize data structures or implement memory pooling'
        });
      }

      // 最適化提案生成
      const optimizationSuggestions = [
        ...(averageExecutionTime > this.config.performanceThreshold ? 
          ['Consider implementing caching for repeated operations'] : []),
        ...(bottlenecks.some(b => b.type === 'memory') ? 
          ['Implement memory optimization strategies'] : []),
        ...(bottlenecks.some(b => b.type === 'cpu') ? 
          ['Profile and optimize CPU-intensive operations'] : [])
      ];

      // スコア計算（100点満点）
      let score = 100;
      if (averageExecutionTime > this.config.performanceThreshold) {
        score -= Math.min(50, (averageExecutionTime / this.config.performanceThreshold) * 20);
      }
      if (memoryUsage > 100) {
        score -= Math.min(30, (memoryUsage / 100) * 10);
      }
      score = Math.max(0, Math.round(score));

      return {
        operation,
        averageExecutionTime,
        memoryUsage,
        cpuUsage,
        bottlenecks,
        optimizationSuggestions,
        score
      };

    } catch (error) {
      return {
        operation,
        averageExecutionTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        bottlenecks: [],
        optimizationSuggestions: ['Performance analysis failed'],
        score: 50
      };
    }
  }

  /**
   * 重複操作検出
   */
  async detectDuplicateOperations(files: string[]): Promise<DuplicationReport> {
    try {
      const duplicates: DuplicateOperation[] = [];
      let totalWastedTime = 0;

      // ファイル内の重複パターン検索
      for (const file of files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))) {
        try {
          const fullPath = join(this.workingDir, file);
          const content = await fs.readFile(fullPath, 'utf-8');
          
          // 重複する関数呼び出しパターンを検索
          const functionCalls = content.match(/\w+\([^)]*\)/g) || [];
          const callCounts = new Map<string, number>();
          
          functionCalls.forEach(call => {
            const simplified = call.replace(/['"]/g, '').replace(/\s+/g, ' ');
            callCounts.set(simplified, (callCounts.get(simplified) || 0) + 1);
          });

          // 閾値を超える重複を検出
          for (const [call, count] of callCounts.entries()) {
            if (count >= this.config.duplicateThreshold) {
              const estimatedTime = count * 10; // 10ms per call estimate
              totalWastedTime += estimatedTime;
              
              duplicates.push({
                operation: call,
                occurrences: count,
                wastedTime: estimatedTime,
                locations: [file],
                consolidationSuggestion: `Consider caching or memoizing ${call}`
              });
            }
          }

        } catch (error) {
          // ファイル読み込みエラーは無視
        }
      }

      // 同じ処理の重複パターンを検出
      const patterns = Array.from(this.operationPatterns.entries());
      patterns.forEach(([pattern, count]) => {
        if (count >= this.config.duplicateThreshold) {
          const estimatedTime = count * 50; // 50ms per operation estimate
          totalWastedTime += estimatedTime;
          
          duplicates.push({
            operation: pattern,
            occurrences: count,
            wastedTime: estimatedTime,
            locations: ['system-wide'],
            consolidationSuggestion: `Consolidate ${pattern} operations`
          });
        }
      });

      const potentialSavings = Math.round(totalWastedTime * 0.8); // 80% savings potential

      const recommendations = [
        ...(duplicates.length > 0 ? ['Implement caching for frequently called operations'] : []),
        ...(totalWastedTime > 1000 ? ['Consider implementing a centralized operation manager'] : []),
        ...(duplicates.some(d => d.occurrences > 10) ? ['High-frequency operations should be optimized first'] : [])
      ];

      return {
        duplicates,
        totalWastedTime,
        potentialSavings,
        recommendations
      };

    } catch (error) {
      return {
        duplicates: [],
        totalWastedTime: 0,
        potentialSavings: 0,
        recommendations: ['Duplication analysis failed']
      };
    }
  }

  /**
   * 自動化機会の特定
   */
  async identifyAutomationOpportunities(context?: any): Promise<AutomationReport> {
    try {
      const opportunities: AutomationOpportunity[] = [];
      let totalManualEffort = 0;

      // 手動タスクパターンの検出
      const manualTasks = [
        {
          task: 'Manual Git Operations',
          frequency: this.operationPatterns.get('git-manual') || 0,
          manualEffort: 2, // 2 minutes per operation
          automationComplexity: 'low' as const,
          description: 'Repetitive git add, commit, push sequences'
        },
        {
          task: 'Manual Code Review Setup',
          frequency: this.operationPatterns.get('review-setup') || 0,
          manualEffort: 5, // 5 minutes per setup
          automationComplexity: 'medium' as const,
          description: 'Setting up pull requests and assigning reviewers'
        },
        {
          task: 'Manual Testing Execution',
          frequency: this.operationPatterns.get('manual-test') || 0,
          manualEffort: 10, // 10 minutes per test run
          automationComplexity: 'medium' as const,
          description: 'Running tests manually instead of automated CI/CD'
        },
        {
          task: 'Manual Documentation Updates',
          frequency: this.operationPatterns.get('doc-update') || 0,
          manualEffort: 15, // 15 minutes per update
          automationComplexity: 'high' as const,
          description: 'Updating documentation after code changes'
        }
      ];

      manualTasks.forEach(task => {
        if (task.frequency > 0) {
          const effort = task.frequency * task.manualEffort;
          totalManualEffort += effort;
          
          // ROI計算（年間での計算）
          const annualSavings = effort * 52; // weekly to annual
          const implementationCost = task.automationComplexity === 'low' ? 8 : 
                                   task.automationComplexity === 'medium' ? 20 : 40; // hours
          const roi = annualSavings / implementationCost;

          opportunities.push({
            task: task.task,
            frequency: task.frequency,
            manualEffort: effort,
            automationComplexity: task.automationComplexity,
            roi,
            description: task.description
          });
        }
      });

      // ROIでソート
      opportunities.sort((a, b) => b.roi - a.roi);

      const potentialAutomation = Math.round(totalManualEffort * 0.7); // 70% automation potential

      const prioritizedRecommendations = opportunities
        .filter(op => op.roi > 1) // ROI > 1 only
        .slice(0, 5) // Top 5
        .map(op => `Automate "${op.task}" (ROI: ${op.roi.toFixed(1)}x, saves ${op.manualEffort}min/week)`);

      return {
        opportunities,
        totalManualEffort,
        potentialAutomation,
        prioritizedRecommendations
      };

    } catch (error) {
      return {
        opportunities: [],
        totalManualEffort: 0,
        potentialAutomation: 0,
        prioritizedRecommendations: ['Automation analysis failed']
      };
    }
  }

  /**
   * キャッシュ効率性評価
   */
  async evaluateCaching(): Promise<CacheEfficiencyReport> {
    try {
      // キャッシュヒット率の簡易計算
      const totalOperations = Array.from(this.operationPatterns.values()).reduce((sum, count) => sum + count, 0);
      const cacheableOperations = Math.floor(totalOperations * 0.3); // 30% are cacheable
      const cacheHits = Math.floor(cacheableOperations * 0.6); // 60% hit rate
      const cacheHitRate = totalOperations > 0 ? cacheHits / totalOperations : 0;

      // キャッシュ機会の検出
      const missedOpportunities: CacheMissOpportunity[] = [];

      // 重複の多い操作をキャッシュ機会として識別
      for (const [operation, frequency] of this.operationPatterns.entries()) {
        if (frequency >= 3 && !operation.includes('cache')) {
          const computationCost = frequency * 100; // ms
          const cacheability = frequency > 10 ? 'high' : frequency > 5 ? 'medium' : 'low';
          
          missedOpportunities.push({
            operation,
            frequency,
            computationCost,
            cacheability: cacheability as any,
            suggestion: `Implement caching for ${operation} (${frequency} occurrences)`
          });
        }
      }

      const recommendations = [
        ...(cacheHitRate < 0.8 ? ['Implement or improve caching strategy'] : []),
        ...(missedOpportunities.length > 0 ? ['Cache frequently repeated operations'] : []),
        ...(missedOpportunities.some(m => m.cacheability === 'high') ? 
          ['High-frequency operations should be cached immediately'] : [])
      ];

      const score = Math.round(cacheHitRate * 100);

      return {
        cacheHitRate,
        missedOpportunities,
        recommendations,
        score
      };

    } catch (error) {
      return {
        cacheHitRate: 0,
        missedOpportunities: [],
        recommendations: ['Cache analysis failed'],
        score: 50
      };
    }
  }

  /**
   * リソース使用量最適化
   */
  async optimizeResourceUsage(): Promise<ResourceOptimizationReport> {
    try {
      const memUsage = process.memoryUsage();
      
      const currentUsage: ResourceUsage = {
        memory: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        cpu: Math.round(process.cpuUsage().user / 1000), // %
        disk: 0, // Simplified
        network: 0 // Simplified
      };

      // 最適化されたリソース使用量の推定
      const optimizedUsage: ResourceUsage = {
        memory: Math.round(currentUsage.memory * 0.8), // 20% reduction potential
        cpu: Math.round(currentUsage.cpu * 0.9), // 10% reduction potential
        disk: currentUsage.disk,
        network: currentUsage.network
      };

      const savings: ResourceSavings = {
        memory: currentUsage.memory - optimizedUsage.memory,
        cpu: currentUsage.cpu - optimizedUsage.cpu,
        disk: 0,
        network: 0,
        cost: ((currentUsage.memory - optimizedUsage.memory) * 0.01) + 
               ((currentUsage.cpu - optimizedUsage.cpu) * 0.02) // Estimated cost savings
      };

      const recommendations = [
        ...(savings.memory > 10 ? ['Implement memory optimization strategies'] : []),
        ...(savings.cpu > 5 ? ['Optimize CPU-intensive operations'] : []),
        ...(currentUsage.memory > 100 ? ['Consider memory pooling or lazy loading'] : []),
        'Use efficient data structures and algorithms'
      ];

      return {
        currentUsage,
        optimizedUsage,
        savings,
        recommendations
      };

    } catch (error) {
      const emptyUsage = { memory: 0, cpu: 0, disk: 0, network: 0 };
      return {
        currentUsage: emptyUsage,
        optimizedUsage: emptyUsage,
        savings: { ...emptyUsage, cost: 0 },
        recommendations: ['Resource analysis failed']
      };
    }
  }

  /**
   * 効率性スコア計算
   */
  private calculateEfficiencyScore(
    performance: PerformanceReport,
    duplication: DuplicationReport,
    automation: AutomationReport,
    cache: CacheEfficiencyReport,
    resource: ResourceOptimizationReport
  ): number {
    // 各要素のスコア正規化
    const performanceScore = performance.score;
    const duplicationScore = duplication.totalWastedTime > 0 ? 
      Math.max(0, 100 - Math.min(50, duplication.totalWastedTime / 100)) : 100;
    const automationScore = automation.totalManualEffort > 0 ? 
      Math.max(0, 100 - Math.min(60, automation.totalManualEffort * 2)) : 100;
    const cacheScore = cache.score;
    const resourceScore = resource.savings.cost > 0 ? 
      Math.min(100, 50 + (resource.savings.cost * 10)) : 70;

    // 重み付き平均（パフォーマンス25%、重複20%、自動化25%、キャッシュ20%、リソース10%）
    return Math.round(
      performanceScore * 0.25 +
      duplicationScore * 0.20 +
      automationScore * 0.25 +
      cacheScore * 0.20 +
      resourceScore * 0.10
    );
  }

  /**
   * 効率性結果分析
   */
  private analyzeEfficiencyResults(
    performance: PerformanceReport,
    duplication: DuplicationReport,
    automation: AutomationReport,
    cache: CacheEfficiencyReport,
    resource: ResourceOptimizationReport
  ): ConstitutionalViolation[] {
    const violations: ConstitutionalViolation[] = [];

    // パフォーマンス違反
    performance.bottlenecks.forEach((bottleneck, index) => {
      violations.push({
        id: `performance-${index}`,
        principle: 'be-lazy',
        severity: bottleneck.impact === 'critical' ? 'critical' : 
                 bottleneck.impact === 'high' ? 'high' : 'medium',
        description: bottleneck.description,
        autoFixable: bottleneck.type !== 'cpu' || bottleneck.impact !== 'critical',
        recommendation: bottleneck.solution
      });
    });

    // 重複違反
    duplication.duplicates.forEach((duplicate, index) => {
      if (duplicate.occurrences >= this.config.duplicateThreshold * 2) {
        violations.push({
          id: `duplication-${index}`,
          principle: 'be-lazy',
          severity: duplicate.occurrences > 10 ? 'high' : 'medium',
          description: `High duplication: ${duplicate.operation} (${duplicate.occurrences} times)`,
          autoFixable: true,
          recommendation: duplicate.consolidationSuggestion
        });
      }
    });

    // 自動化違反
    automation.opportunities.forEach((opportunity, index) => {
      if (opportunity.roi > 2 && opportunity.automationComplexity !== 'high') {
        violations.push({
          id: `automation-${index}`,
          principle: 'be-lazy',
          severity: opportunity.roi > 5 ? 'high' : 'medium',
          description: `High-value automation opportunity: ${opportunity.task} (ROI: ${opportunity.roi.toFixed(1)}x)`,
          autoFixable: opportunity.automationComplexity === 'low',
          recommendation: `Implement automation for ${opportunity.task}`
        });
      }
    });

    // キャッシュ違反
    if (cache.cacheHitRate < 0.6) {
      violations.push({
        id: 'cache-efficiency',
        principle: 'be-lazy',
        severity: cache.cacheHitRate < 0.3 ? 'high' : 'medium',
        description: `Low cache hit rate: ${Math.round(cache.cacheHitRate * 100)}%`,
        autoFixable: true,
        recommendation: 'Implement or improve caching strategy'
      });
    }

    // リソース違反
    if (resource.savings.cost > 1) {
      violations.push({
        id: 'resource-waste',
        principle: 'be-lazy',
        severity: resource.savings.cost > 5 ? 'high' : 'medium',
        description: `Significant resource waste detected (potential savings: $${resource.savings.cost.toFixed(2)})`,
        autoFixable: false,
        recommendation: 'Optimize resource usage patterns'
      });
    }

    return violations;
  }

  /**
   * 効率性推奨事項生成
   */
  private generateEfficiencyRecommendations(violations: ConstitutionalViolation[]): string[] {
    const recommendations = new Set<string>();

    violations.forEach(violation => {
      recommendations.add(violation.recommendation);
    });

    // 一般的な推奨事項
    if (violations.some(v => v.description.includes('duplication'))) {
      recommendations.add('Consider implementing a centralized operation manager');
    }

    if (violations.some(v => v.description.includes('performance'))) {
      recommendations.add('Profile application to identify performance bottlenecks');
    }

    if (violations.some(v => v.description.includes('automation'))) {
      recommendations.add('Prioritize automation opportunities with highest ROI');
    }

    if (violations.length > 5) {
      recommendations.add('Consider systematic efficiency improvements across the system');
    }

    return Array.from(recommendations);
  }

  /**
   * 操作パターン記録
   */
  recordOperation(operation: string): void {
    this.operationPatterns.set(operation, (this.operationPatterns.get(operation) || 0) + 1);
  }

  /**
   * パフォーマンス記録
   */
  recordPerformance(operation: string, executionTime: number): void {
    if (!this.performanceHistory.has(operation)) {
      this.performanceHistory.set(operation, []);
    }
    
    const history = this.performanceHistory.get(operation)!;
    history.push(executionTime);
    
    // 直近20回の記録のみ保持
    if (history.length > 20) {
      history.shift();
    }
  }

  /**
   * 設定更新
   */
  updateConfig(newConfig: Partial<BeLazyConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 無効時の結果
   */
  private getDisabledResult(): BeLazyResult {
    const emptyUsage = { memory: 0, cpu: 0, disk: 0, network: 0 };
    
    return {
      score: 0,
      violations: [],
      recommendations: ['Be Lazy checker is disabled'],
      details: {
        performance: {
          operation: 'disabled',
          averageExecutionTime: 0,
          memoryUsage: 0,
          cpuUsage: 0,
          bottlenecks: [],
          optimizationSuggestions: [],
          score: 0
        },
        duplication: {
          duplicates: [],
          totalWastedTime: 0,
          potentialSavings: 0,
          recommendations: []
        },
        automation: {
          opportunities: [],
          totalManualEffort: 0,
          potentialAutomation: 0,
          prioritizedRecommendations: []
        },
        cache: {
          cacheHitRate: 0,
          missedOpportunities: [],
          recommendations: [],
          score: 0
        },
        resource: {
          currentUsage: emptyUsage,
          optimizedUsage: emptyUsage,
          savings: { ...emptyUsage, cost: 0 },
          recommendations: []
        }
      }
    };
  }

  /**
   * エラー時の結果
   */
  private getErrorResult(error: any): BeLazyResult {
    const emptyUsage = { memory: 0, cpu: 0, disk: 0, network: 0 };
    
    return {
      score: 0,
      violations: [{
        id: 'checker-error',
        principle: 'be-lazy',
        severity: 'critical',
        description: `Be Lazy checker error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        autoFixable: false,
        recommendation: 'Check Be Lazy checker configuration and dependencies'
      }],
      recommendations: ['Fix Be Lazy checker error'],
      details: {
        performance: {
          operation: 'error',
          averageExecutionTime: 0,
          memoryUsage: 0,
          cpuUsage: 0,
          bottlenecks: [],
          optimizationSuggestions: [],
          score: 0
        },
        duplication: {
          duplicates: [],
          totalWastedTime: 0,
          potentialSavings: 0,
          recommendations: []
        },
        automation: {
          opportunities: [],
          totalManualEffort: 0,
          potentialAutomation: 0,
          prioritizedRecommendations: []
        },
        cache: {
          cacheHitRate: 0,
          missedOpportunities: [],
          recommendations: [],
          score: 0
        },
        resource: {
          currentUsage: emptyUsage,
          optimizedUsage: emptyUsage,
          savings: { ...emptyUsage, cost: 0 },
          recommendations: []
        }
      }
    };
  }
}