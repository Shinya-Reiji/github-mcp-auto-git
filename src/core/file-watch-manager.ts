/**
 * File Watch Manager Module
 * Handles file monitoring and change processing following Constitutional AI principles
 */

import { watch, FSWatcher } from 'chokidar';
import { GitConfig } from '../types/index.js';
import { GitOperations } from './git-operations.js';

export interface FileChangeEvent {
  path: string;
  type: 'change' | 'add' | 'delete';
  timestamp: number;
}

export interface WatchResult {
  success: boolean;
  message: string;
  details?: any;
  warnings?: string[];
}

export class FileWatchManager {
  private watcher?: FSWatcher;
  private debounceTimer?: NodeJS.Timeout;
  private isProcessing = false;
  private config: GitConfig;
  private gitOps: GitOperations;

  constructor(config: GitConfig, gitOps: GitOperations) {
    this.config = config;
    this.gitOps = gitOps;
  }

  /**
   * Start file watching with robust error handling
   * Fail Fast: Immediate validation of watch patterns and permissions
   * Be Lazy: Efficient file filtering and debounced processing
   * TypeScript First: Complete type safety for file operations
   */
  async startWatching(): Promise<void> {
    if (!this.config.enabled) {
      throw new Error('File watching is disabled in configuration');
    }

    // Validate watch patterns
    if (!this.config.paths || this.config.paths.length === 0) {
      throw new Error('No watch patterns configured');
    }

    console.log('👀 ファイル監視を開始します...');
    console.log('📁 監視対象:', this.config.paths.join(', '));
    
    try {
      this.watcher = watch(this.config.paths, {
        ignored: this.getIgnoredPatterns(),
        ignoreInitial: true,
        persistent: true,
        awaitWriteFinish: {
          stabilityThreshold: 500,
          pollInterval: 100
        }
      });

      this.setupEventHandlers();
      
      console.log('✅ ファイル監視が開始されました');
      console.log(`📋 PID: ${process.pid} (プロセス監視用)`);
      console.log('💡 Ctrl+C で停止できます');
      
    } catch (error) {
      throw new Error(`Failed to start file watching: ${error}`);
    }
  }

  /**
   * Stop file watching and cleanup resources
   * Fail Fast: Immediate cleanup on errors
   */
  async stopWatching(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
      console.log('⏹️ ファイル監視を停止しました');
    }
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
  }

  /**
   * Process file changes with debouncing and error recovery
   * Be Lazy: Debounced processing to avoid excessive operations
   * Fail Fast: Early termination on processing conflicts
   */
  async processChanges(files?: string[]): Promise<WatchResult> {
    if (this.isProcessing) {
      console.log('⏳ 既に処理中です...');
      return {
        success: false,
        message: 'Already processing changes'
      };
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      console.log('\n🔄 Git操作を開始します...');
      
      const result = await this.gitOps.executeGitWorkflow(files, {
        autoCommit: true,
        autoPush: this.config.github.token ? true : false,
        createPR: this.config.subAgents.prManagementAgent.enabled && this.config.github.token ? true : false
      });

      if (result.success) {
        console.log('\n' + result.message);
        
        if (this.config.notifications.detailed && result.details) {
          this.displayDetailedResult(result);
        }
        
        if (result.warnings && result.warnings.length > 0 && this.config.notifications.warnings) {
          console.log('\n⚠️ 警告:');
          result.warnings.forEach(warning => console.log(`  • ${warning}`));
        }

        return {
          success: true,
          message: result.message,
          details: result.details,
          warnings: result.warnings
        };
      } else {
        console.error('\n❌ Git操作が失敗しました:', result.message);
        
        if (result.warnings && result.warnings.length > 0) {
          console.log('\n詳細:');
          result.warnings.forEach(warning => console.log(`  • ${warning}`));
        }

        return {
          success: false,
          message: result.message,
          warnings: result.warnings
        };
      }

    } catch (error) {
      console.error('❌ 予期しないエラーが発生しました:', error);
      return {
        success: false,
        message: `Unexpected error: ${error}`
      };
    } finally {
      this.isProcessing = false;
      const processingTime = Date.now() - startTime;
      console.log(`\n⏱️ 処理時間: ${processingTime}ms`);
      console.log('👀 ファイル監視を継続中...\n');
    }
  }

  /**
   * Check if currently processing changes
   * TypeScript First: Type-safe status checking
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Get current watch status
   * Be Lazy: Efficient status reporting
   */
  getWatchStatus(): {
    watching: boolean;
    processing: boolean;
    patterns: string[];
    ignored: string[];
  } {
    return {
      watching: !!this.watcher,
      processing: this.isProcessing,
      patterns: this.config.paths,
      ignored: this.getIgnoredPatterns().map(pattern => 
        pattern instanceof RegExp ? pattern.toString() : pattern
      )
    };
  }

  /**
   * Setup event handlers for file changes
   * Fail Fast: Immediate error handling for file events
   */
  private setupEventHandlers(): void {
    if (!this.watcher) {
      throw new Error('Watcher not initialized');
    }

    this.watcher
      .on('change', (path: string) => this.handleFileChange(path, 'change'))
      .on('add', (path: string) => this.handleFileChange(path, 'add'))
      .on('unlink', (path: string) => this.handleFileChange(path, 'delete'))
      .on('error', (error: Error) => {
        console.error('❌ ファイル監視エラー:', error);
        // Attempt to restart watching after error
        this.handleWatchError(error);
      })
      .on('ready', () => {
        console.log('🔄 ファイル監視システム準備完了');
      });
  }

  /**
   * Handle individual file change events
   * Be Lazy: Debounced processing to batch changes
   */
  private async handleFileChange(filePath: string, type: 'change' | 'add' | 'delete'): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    // Filter out ignored patterns at runtime
    if (this.shouldIgnoreFile(filePath)) {
      return;
    }

    console.log(`📝 ファイル${type === 'change' ? '変更' : type === 'add' ? '追加' : '削除'}: ${filePath}`);

    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Debounce file changes to avoid excessive processing
    this.debounceTimer = setTimeout(async () => {
      await this.processChanges([filePath]);
    }, 2000);
  }

  /**
   * Handle watch errors with recovery attempts
   * Fail Fast: Immediate error detection and recovery
   */
  private async handleWatchError(error: Error): Promise<void> {
    console.warn('⚠️ ファイル監視でエラーが発生しました。復旧を試行します...', error.message);
    
    try {
      // Attempt to restart watching
      await this.stopWatching();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      await this.startWatching();
      console.log('✅ ファイル監視を復旧しました');
    } catch (restartError) {
      console.error('❌ ファイル監視の復旧に失敗しました:', restartError);
      throw new Error(`File watching recovery failed: ${restartError}`);
    }
  }

  /**
   * Get patterns to ignore during file watching
   * Be Lazy: Comprehensive ignore patterns for efficiency
   */
  private getIgnoredPatterns(): Array<string | RegExp> {
    return [
      /node_modules/,
      /\.git/,
      /dist/,
      /build/,
      /coverage/,
      '**/*.pid',
      '.github-auto-git.pid',
      '**/*.log',
      '**/*.tmp',
      '**/.*',
      '!.env',
      '!.gitignore'
    ];
  }

  /**
   * Check if a specific file should be ignored
   * Fail Fast: Early filtering of irrelevant files
   */
  private shouldIgnoreFile(filePath: string): boolean {
    const ignoredPatterns = this.getIgnoredPatterns();
    
    return ignoredPatterns.some(pattern => {
      if (pattern instanceof RegExp) {
        return pattern.test(filePath);
      }
      
      // Handle glob patterns
      if (typeof pattern === 'string') {
        if (pattern.startsWith('!')) {
          return false; // Negation patterns are handled by chokidar
        }
        
        // Simple pattern matching
        if (pattern.includes('*')) {
          const regexPattern = pattern
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*');
          return new RegExp(regexPattern).test(filePath);
        }
        
        return filePath.includes(pattern);
      }
      
      return false;
    });
  }

  /**
   * Display detailed processing results
   * TypeScript First: Type-safe result display
   */
  private displayDetailedResult(result: any): void {
    console.log('\n📊 詳細結果:');
    
    if (result.details.safety) {
      const safety = result.details.safety;
      console.log(`  🔒 安全性: ${safety.level} (${safety.safetyScore}/100)`);
      if (safety.risks.length > 0) {
        console.log('  ⚠️ リスク:');
        safety.risks.forEach((risk: any) => {
          console.log(`    • ${risk.description}`);
        });
      }
    }

    if (result.details.commitMessage) {
      const msg = result.details.commitMessage;
      console.log(`  📝 コミットタイトル: ${msg.title}`);
      console.log(`  📋 Conventional: ${msg.conventional}`);
    }

    if (result.details.prManagement) {
      const pr = result.details.prManagement;
      console.log(`  🔀 マージ戦略: ${pr.mergeStrategy}`);
      console.log(`  🏷️ ラベル: ${pr.labels.join(', ')}`);
      if (pr.reviewers.length > 0) {
        console.log(`  👥 レビュアー: ${pr.reviewers.join(', ')}`);
      }
    }
  }
}