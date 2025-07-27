/**
 * GitAutoMCP Core Class - Refactored for Modularity
 * Main orchestration class following Constitutional AI principles
 */

import { GitOperations } from './git-operations.js';
import { FileWatchManager, WatchResult } from './file-watch-manager.js';
import { InteractiveConfigManager, ConfigurationResult } from './interactive-config-manager.js';
import { SystemStatusManager, SystemHealth } from './system-status-manager.js';
import { SubAgentManager } from './subagent-manager.js';
import { GitConfig } from '../types/index.js';

export interface GitAutoMCPStatus {
  enabled: boolean;
  watching: boolean;
  processing: boolean;
  agents: string[];
  config: GitConfig;
  health: SystemHealth;
}

export class GitAutoMCP {
  private gitOps!: GitOperations;
  private fileWatchManager!: FileWatchManager;
  private configManager!: InteractiveConfigManager;
  private statusManager!: SystemStatusManager;
  private subAgentManager!: SubAgentManager;
  private config: GitConfig;
  private configPath?: string;

  constructor(configPath?: string) {
    this.config = {} as GitConfig; // Temporary initialization
    this.configPath = configPath;
  }

  /**
   * Initialize the GitAutoMCP system
   * Fail Fast: Comprehensive validation and early error detection
   * Be Lazy: Efficient module initialization with dependency injection
   * TypeScript First: Complete type safety throughout initialization
   */
  async initialize(): Promise<void> {
    console.log('🚀 GitHub MCP Auto Git System を初期化しています...');
    
    try {
      // Load configuration
      this.config = await this.loadConfig(this.configPath);
      
      // Initialize core components
      this.gitOps = new GitOperations(this.config);
      await this.gitOps.initialize();
      
      // Initialize managers
      this.fileWatchManager = new FileWatchManager(this.config, this.gitOps);
      this.configManager = new InteractiveConfigManager(this.config);
      this.statusManager = new SystemStatusManager(this.config);
      this.subAgentManager = new SubAgentManager('./src/agents', process.cwd());
      
      // Validate GitHub token
      if (!this.config.github.token) {
        console.warn('⚠️ GITHUB_TOKEN が設定されていません。PR機能は無効になります。');
      }
      
      // Start health monitoring
      this.statusManager.startHealthMonitoring();
      
      // Setup PID file management
      const pidManager = await this.statusManager.managePIDFile();
      await pidManager.create();
      
      console.log('✅ 初期化完了');
      console.log('📁 監視パターン:', this.config.paths.join(', '));
      console.log('🤖 有効なサブエージェント:', this.getEnabledAgents().join(', '));
      
    } catch (error) {
      console.error('❌ 初期化に失敗しました:', error);
      throw new Error(`Initialization failed: ${error}`);
    }
  }

  /**
   * Start file watching with interactive configuration
   * Be Lazy: Reuse existing configuration when possible
   */
  async startWatching(): Promise<void> {
    if (!this.config.enabled) {
      throw new Error('System is disabled in configuration');
    }

    try {
      // Interactive watch pattern configuration
      const configResult = await this.configManager.configureWatchPatterns();
      if (configResult.success && configResult.config) {
        this.config = configResult.config;
        // Reinitialize file watch manager with new config
        this.fileWatchManager = new FileWatchManager(this.config, this.gitOps);
      }

      // Start file watching
      await this.fileWatchManager.startWatching();
      
      // Start health monitoring
      this.statusManager.startHealthMonitoring();
      
    } catch (error) {
      console.error('❌ ファイル監視の開始に失敗しました:', error);
      throw error;
    }
  }

  /**
   * Process changes manually (one-time execution)
   * TypeScript First: Strongly typed change processing
   */
  async runOnce(files?: string[]): Promise<WatchResult> {
    await this.ensureInitialized();
    
    const startTime = Date.now();
    const result = await this.fileWatchManager.processChanges(files);
    const processingTime = Date.now() - startTime;
    
    // Record metrics
    this.statusManager.recordProcessingMetrics(
      result.success, 
      processingTime, 
      files?.length || 1
    );
    
    return result;
  }

  /**
   * Stop all operations and cleanup
   * Fail Fast: Comprehensive cleanup with error handling
   */
  async stop(): Promise<void> {
    try {
      // Stop file watching
      if (this.fileWatchManager) {
        await this.fileWatchManager.stopWatching();
      }
      
      // Cleanup Git operations and MCP resources
      if (this.gitOps) {
        await this.gitOps.cleanup();
      }
      
      // Cleanup SubAgent Manager and memory executor
      if (this.subAgentManager) {
        await this.subAgentManager.cleanup();
      }
      
      // Stop health monitoring
      if (this.statusManager) {
        this.statusManager.stopHealthMonitoring();
        
        // Remove PID file
        const pidManager = await this.statusManager.managePIDFile();
        await pidManager.remove();
      }
      
      console.log('✅ システムを正常に停止しました');
    } catch (error) {
      console.error('⚠️ 停止処理中にエラーが発生しました:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive system status
   * Be Lazy: Cached status with efficient updates
   */
  async getStatus(): Promise<GitAutoMCPStatus> {
    await this.ensureInitialized();
    return await this.statusManager.getSystemStatus();
  }

  /**
   * Configure system interactively
   * TypeScript First: Complete configuration type safety
   */
  async configureInteractively(): Promise<ConfigurationResult> {
    await this.ensureInitialized();
    
    try {
      // Configure subagents
      const subagentResult = await this.configManager.configureSubagents();
      if (!subagentResult.success) {
        return subagentResult;
      }
      
      // Configure notifications
      const notificationResult = await this.configManager.configureNotifications();
      if (!notificationResult.success) {
        return notificationResult;
      }
      
      // Update configuration
      if (subagentResult.config) {
        this.config = subagentResult.config;
      }
      
      console.log('✅ 対話的設定が完了しました');
      return {
        success: true,
        config: this.config
      };
      
    } catch (error) {
      console.error('❌ 対話的設定に失敗しました:', error);
      return {
        success: false,
        message: `Interactive configuration failed: ${error}`
      };
    }
  }

  /**
   * Display system health report
   * Be Lazy: Efficient health reporting with visual formatting
   */
  async displayHealthReport(): Promise<void> {
    const status = await this.getStatus();
    this.statusManager.displaySystemStatus(status.health);
  }

  /**
   * Load configuration with defaults and validation
   * Fail Fast: Immediate configuration validation
   */
  private async loadConfig(configPath?: string): Promise<GitConfig> {
    const defaultConfig: GitConfig = {
      enabled: true,
      triggers: ['save', 'auto'],
      paths: ['src/**/*', '!node_modules/**'],
      subAgents: {
        gitSafetyAnalyzer: {
          enabled: true,
          safetyThreshold: 0.85
        },
        commitMessageGenerator: {
          enabled: true,
          language: 'ja',
          style: 'friendly'
        },
        prManagementAgent: {
          enabled: true,
          autoMergeThreshold: 0.85
        }
      },
      notifications: {
        success: true,
        warnings: true,
        detailed: false
      },
      github: {
        owner: process.env.GITHUB_OWNER || '',
        repo: process.env.GITHUB_REPO || '',
        token: process.env.GITHUB_TOKEN || ''
      }
    };

    if (configPath) {
      try {
        const { default: userConfig } = await import(configPath);
        return { ...defaultConfig, ...userConfig };
      } catch (error) {
        console.warn(`設定ファイルの読み込みに失敗しました: ${error}`);
      }
    }

    return defaultConfig;
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
   * Ensure system is properly initialized
   * Fail Fast: Prevent operations on uninitialized system
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.gitOps || !this.fileWatchManager || !this.statusManager) {
      await this.initialize();
    }
  }
}