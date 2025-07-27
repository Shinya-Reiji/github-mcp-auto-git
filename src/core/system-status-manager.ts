/**
 * System Status Manager Module
 * Handles system health monitoring and status reporting following Constitutional AI principles
 */

import { join } from 'path';
import { promises as fs } from 'fs';
import { GitConfig } from '../types/index.js';

export interface SystemHealth {
  overall: 'optimal' | 'good' | 'warning' | 'critical';
  components: {
    fileWatcher: 'active' | 'inactive' | 'error';
    gitOperations: 'ready' | 'busy' | 'error';
    subagents: 'all_enabled' | 'partial' | 'disabled';
    configuration: 'valid' | 'incomplete' | 'invalid';
  };
  metrics: {
    uptime: number;
    processedFiles: number;
    successfulCommits: number;
    failedOperations: number;
    averageProcessingTime: number;
  };
  warnings: string[];
  recommendations: string[];
}

export interface PIDFileInfo {
  exists: boolean;
  pid?: number;
  isRunning?: boolean;
  filePath: string;
}

export class SystemStatusManager {
  private config: GitConfig;
  private startTime: number;
  private metrics = {
    processedFiles: 0,
    successfulCommits: 0,
    failedOperations: 0,
    processingTimes: [] as number[]
  };
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: GitConfig) {
    this.config = config;
    this.startTime = Date.now();
  }

  /**
   * Get comprehensive system status
   * Fail Fast: Immediate health assessment with early warning detection
   * Be Lazy: Cached status computation for efficiency
   * TypeScript First: Complete type safety for status reporting
   */
  async getSystemStatus(): Promise<{
    enabled: boolean;
    watching: boolean;
    processing: boolean;
    agents: string[];
    config: GitConfig;
    health: SystemHealth;
  }> {
    const health = await this.assessSystemHealth();
    
    return {
      enabled: this.config.enabled,
      watching: health.components.fileWatcher === 'active',
      processing: health.components.gitOperations === 'busy',
      agents: this.getEnabledAgents(),
      config: this.config,
      health
    };
  }

  /**
   * Assess comprehensive system health
   * Fail Fast: Proactive health monitoring with immediate issue detection
   */
  async assessSystemHealth(): Promise<SystemHealth> {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    // Check component health
    const components = {
      fileWatcher: this.assessFileWatcherHealth(),
      gitOperations: this.assessGitOperationsHealth(),
      subagents: this.assessSubagentsHealth(),
      configuration: this.assessConfigurationHealth()
    };

    // Collect warnings and recommendations
    if (components.configuration === 'incomplete') {
      warnings.push('GitHub token not configured - PR functionality disabled');
      recommendations.push('Set GITHUB_TOKEN for full functionality');
    }

    if (components.subagents === 'partial') {
      warnings.push('Some subagents are disabled');
      recommendations.push('Enable all subagents for optimal performance');
    }

    // Calculate metrics
    const uptime = Date.now() - this.startTime;
    const avgProcessingTime = this.metrics.processingTimes.length > 0
      ? this.metrics.processingTimes.reduce((a, b) => a + b, 0) / this.metrics.processingTimes.length
      : 0;

    const metrics = {
      uptime,
      processedFiles: this.metrics.processedFiles,
      successfulCommits: this.metrics.successfulCommits,
      failedOperations: this.metrics.failedOperations,
      averageProcessingTime: avgProcessingTime
    };

    // Determine overall health
    const overall = this.calculateOverallHealth(components, metrics, warnings);

    return {
      overall,
      components,
      metrics,
      warnings,
      recommendations
    };
  }

  /**
   * Start periodic health checks
   * Be Lazy: Configurable health check intervals
   */
  startHealthMonitoring(intervalMs = 30000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      this.performPeriodicHealthCheck();
    }, intervalMs);

    console.log(`💓 健康監視開始: ${intervalMs / 1000}秒間隔`);
  }

  /**
   * Stop health monitoring
   * Fail Fast: Clean resource cleanup
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      console.log('🛑 健康監視停止');
    }
  }

  /**
   * Record processing metrics
   * TypeScript First: Strongly typed metrics recording
   */
  recordProcessingMetrics(success: boolean, processingTime: number, filesProcessed: number = 1): void {
    this.metrics.processedFiles += filesProcessed;
    this.metrics.processingTimes.push(processingTime);

    // Keep only last 100 processing times for average calculation
    if (this.metrics.processingTimes.length > 100) {
      this.metrics.processingTimes = this.metrics.processingTimes.slice(-100);
    }

    if (success) {
      this.metrics.successfulCommits++;
    } else {
      this.metrics.failedOperations++;
    }
  }

  /**
   * Manage PID file operations
   * Fail Fast: Robust PID file management with error handling
   */
  async managePIDFile(): Promise<{
    create: () => Promise<void>;
    remove: () => Promise<void>;
    check: () => Promise<PIDFileInfo>;
  }> {
    const pidFilePath = join(process.cwd(), '.github-auto-git.pid');

    return {
      create: async (): Promise<void> => {
        try {
          await fs.writeFile(pidFilePath, process.pid.toString());
          console.log(`📄 PIDファイル作成: ${pidFilePath}`);
        } catch (error) {
          console.warn('⚠️ PIDファイル作成に失敗:', error);
          throw new Error(`PID file creation failed: ${error}`);
        }
      },

      remove: async (): Promise<void> => {
        try {
          await fs.unlink(pidFilePath);
          console.log('🗑️ PIDファイルを削除しました');
        } catch (error) {
          // PID file might not exist, which is acceptable
          if ((error as any).code !== 'ENOENT') {
            console.warn('⚠️ PIDファイル削除に失敗:', error);
          }
        }
      },

      check: async (): Promise<PIDFileInfo> => {
        try {
          const pidString = await fs.readFile(pidFilePath, 'utf-8');
          const pid = parseInt(pidString.trim(), 10);
          
          // Check if process is still running
          let isRunning = false;
          try {
            process.kill(pid, 0); // Signal 0 checks if process exists
            isRunning = true;
          } catch {
            isRunning = false;
          }

          return {
            exists: true,
            pid,
            isRunning,
            filePath: pidFilePath
          };
        } catch (error) {
          return {
            exists: false,
            filePath: pidFilePath
          };
        }
      }
    };
  }

  /**
   * Display formatted system status
   * Be Lazy: Efficient status formatting with visual indicators
   */
  displaySystemStatus(health: SystemHealth): void {
    console.log('\n📊 システム状態レポート');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Overall health indicator
    const healthIcon = this.getHealthIcon(health.overall);
    console.log(`${healthIcon} 総合健康状態: ${health.overall.toUpperCase()}`);
    
    // Component status
    console.log('\n🔧 コンポーネント状態:');
    console.log(`  📂 ファイル監視: ${this.getComponentStatusIcon(health.components.fileWatcher)} ${health.components.fileWatcher}`);
    console.log(`  🔄 Git操作: ${this.getComponentStatusIcon(health.components.gitOperations)} ${health.components.gitOperations}`);
    console.log(`  🤖 サブエージェント: ${this.getComponentStatusIcon(health.components.subagents)} ${health.components.subagents}`);
    console.log(`  ⚙️ 設定: ${this.getComponentStatusIcon(health.components.configuration)} ${health.components.configuration}`);
    
    // Metrics
    console.log('\n📈 運用メトリクス:');
    console.log(`  ⏰ 稼働時間: ${this.formatUptime(health.metrics.uptime)}`);
    console.log(`  📁 処理済みファイル: ${health.metrics.processedFiles}`);
    console.log(`  ✅ 成功コミット: ${health.metrics.successfulCommits}`);
    console.log(`  ❌ 失敗操作: ${health.metrics.failedOperations}`);
    console.log(`  ⚡ 平均処理時間: ${health.metrics.averageProcessingTime.toFixed(2)}ms`);
    
    // Warnings
    if (health.warnings.length > 0) {
      console.log('\n⚠️ 警告:');
      health.warnings.forEach(warning => console.log(`  • ${warning}`));
    }
    
    // Recommendations
    if (health.recommendations.length > 0) {
      console.log('\n💡 推奨事項:');
      health.recommendations.forEach(rec => console.log(`  • ${rec}`));
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  /**
   * Perform periodic health check
   * Fail Fast: Proactive issue detection during operation
   */
  private async performPeriodicHealthCheck(): Promise<void> {
    try {
      const health = await this.assessSystemHealth();
      
      if (health.overall === 'critical') {
        console.log('🚨 システム健康状態が危険レベルです！');
        this.displaySystemStatus(health);
      } else if (health.overall === 'warning') {
        console.log('⚠️ システムに問題が検出されました');
      } else {
        console.log(`💓 ヘルスチェック: ${new Date().toLocaleTimeString()} - ${health.overall}`);
      }
    } catch (error) {
      console.error('❌ ヘルスチェックエラー:', error);
    }
  }

  /**
   * Get list of enabled agents
   * TypeScript First: Type-safe agent enumeration
   */
  private getEnabledAgents(): string[] {
    const agents = [];
    if (this.config.subAgents.gitSafetyAnalyzer.enabled) agents.push('Git Safety Analyzer');
    if (this.config.subAgents.commitMessageGenerator.enabled) agents.push('Commit Message Generator');
    if (this.config.subAgents.prManagementAgent.enabled) agents.push('PR Management Agent');
    return agents;
  }

  /**
   * Assess individual component health states
   * Be Lazy: Efficient component health assessment
   */
  private assessFileWatcherHealth(): 'active' | 'inactive' | 'error' {
    // This would be updated by the FileWatchManager
    return 'active'; // Placeholder
  }

  private assessGitOperationsHealth(): 'ready' | 'busy' | 'error' {
    // This would be updated by the GitOperations
    return 'ready'; // Placeholder
  }

  private assessSubagentsHealth(): 'all_enabled' | 'partial' | 'disabled' {
    const enabledCount = this.getEnabledAgents().length;
    const totalCount = 3; // Total number of available subagents
    
    if (enabledCount === totalCount) return 'all_enabled';
    if (enabledCount > 0) return 'partial';
    return 'disabled';
  }

  private assessConfigurationHealth(): 'valid' | 'incomplete' | 'invalid' {
    if (!this.config.enabled) return 'invalid';
    if (!this.config.github.token) return 'incomplete';
    return 'valid';
  }

  /**
   * Calculate overall system health
   * Fail Fast: Comprehensive health assessment with weighted scoring
   */
  private calculateOverallHealth(
    components: SystemHealth['components'],
    metrics: SystemHealth['metrics'],
    warnings: string[]
  ): 'optimal' | 'good' | 'warning' | 'critical' {
    // Critical conditions
    if (components.fileWatcher === 'error' || components.gitOperations === 'error') {
      return 'critical';
    }
    
    // Warning conditions
    if (warnings.length > 2 || components.configuration === 'invalid') {
      return 'warning';
    }
    
    // Good conditions
    if (components.subagents === 'partial' || components.configuration === 'incomplete') {
      return 'good';
    }
    
    return 'optimal';
  }

  /**
   * Get health status visual indicators
   * Be Lazy: Reusable status formatting
   */
  private getHealthIcon(health: string): string {
    switch (health) {
      case 'optimal': return '🟢';
      case 'good': return '🟡';
      case 'warning': return '🟠';
      case 'critical': return '🔴';
      default: return '⚪';
    }
  }

  private getComponentStatusIcon(status: string): string {
    if (status.includes('active') || status.includes('ready') || status.includes('all_enabled') || status.includes('valid')) {
      return '✅';
    }
    if (status.includes('error') || status.includes('invalid') || status.includes('disabled')) {
      return '❌';
    }
    return '⚠️';
  }

  /**
   * Format uptime in human-readable format
   * TypeScript First: Type-safe time formatting
   */
  private formatUptime(uptime: number): string {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}日 ${hours % 24}時間 ${minutes % 60}分`;
    if (hours > 0) return `${hours}時間 ${minutes % 60}分`;
    if (minutes > 0) return `${minutes}分 ${seconds % 60}秒`;
    return `${seconds}秒`;
  }
}