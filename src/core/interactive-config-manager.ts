/**
 * Interactive Configuration Manager Module
 * Handles interactive setup and configuration following Constitutional AI principles
 */

import * as readline from 'readline';
import { GitConfig } from '../types/index.js';

export interface ConfigurationResult {
  success: boolean;
  config?: GitConfig;
  message?: string;
}

export interface WatchPatternOptions {
  current: string[];
  projectWide: string[];
  custom: string[];
}

export class InteractiveConfigManager {
  private config: GitConfig;

  constructor(config: GitConfig) {
    this.config = { ...config };
  }

  /**
   * Configure watch patterns interactively
   * Fail Fast: Validate user input immediately
   * Be Lazy: Reuse common pattern configurations
   * TypeScript First: Complete type safety for configuration
   */
  async configureWatchPatterns(): Promise<ConfigurationResult> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      console.log('\n🔧 監視設定');
      console.log('現在の監視パターン:', this.config.paths.join(', '));
      
      const answer = await this.askQuestion(rl, '\n📁 監視したいフォルダ/ファイルを指定してください:\n' +
        '  1. 現在のまま (src/**/*)\n' +
        '  2. プロジェクト全体 (**/*)\n' +
        '  3. カスタム設定\n' +
        '選択 (1-3): ');

      const result = await this.processWatchPatternChoice(rl, answer);
      rl.close();
      
      return result;
    } catch (error) {
      rl.close();
      return {
        success: false,
        message: `Configuration failed: ${error}`
      };
    }
  }

  /**
   * Configure subagent settings interactively
   * TypeScript First: Strongly typed subagent configuration
   */
  async configureSubagents(): Promise<ConfigurationResult> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      console.log('\n🤖 サブエージェント設定');
      
      // Git Safety Analyzer configuration
      const safetyEnabled = await this.askYesNo(rl, 
        '🛡️ Git Safety Analyzer を有効にしますか？ (機密情報・破壊的変更検出) [Y/n]: ');
      
      let safetyThreshold = 0.85;
      if (safetyEnabled) {
        const thresholdAnswer = await this.askQuestion(rl,
          '🔒 安全性閾値を設定してください (0.0-1.0, デフォルト: 0.85): ');
        const parsedThreshold = parseFloat(thresholdAnswer) || 0.85;
        safetyThreshold = Math.max(0, Math.min(1, parsedThreshold));
      }

      // Commit Message Generator configuration
      const commitEnabled = await this.askYesNo(rl,
        '📝 Commit Message Generator を有効にしますか？ (非エンジニア向けメッセージ生成) [Y/n]: ');
      
      let language = 'ja';
      let style = 'friendly';
      if (commitEnabled) {
        const languageChoice = await this.askChoice(rl,
          '🌐 メッセージ言語を選択してください: ',
          ['ja (日本語)', 'en (English)'],
          'ja');
        language = languageChoice.split(' ')[0] || 'ja';
        
        const styleChoice = await this.askChoice(rl,
          '💬 メッセージスタイルを選択してください: ',
          ['friendly (親しみやすい)', 'professional (プロフェッショナル)', 'technical (技術的)'],
          'friendly');
        style = styleChoice.split(' ')[0] || 'friendly';
      }

      // PR Management Agent configuration
      const prEnabled = await this.askYesNo(rl,
        '🔀 PR Management Agent を有効にしますか？ (自動マージ判定・PR管理) [Y/n]: ');
      
      let autoMergeThreshold = 0.85;
      if (prEnabled) {
        const mergeAnswer = await this.askQuestion(rl,
          '🔄 自動マージ閾値を設定してください (0.0-1.0, デフォルト: 0.85): ');
        const parsedMerge = parseFloat(mergeAnswer) || 0.85;
        autoMergeThreshold = Math.max(0, Math.min(1, parsedMerge));
      }

      // Update configuration
      this.config.subAgents = {
        gitSafetyAnalyzer: {
          enabled: safetyEnabled,
          safetyThreshold
        },
        commitMessageGenerator: {
          enabled: commitEnabled,
          language,
          style
        },
        prManagementAgent: {
          enabled: prEnabled,
          autoMergeThreshold
        }
      };

      rl.close();
      
      console.log('\n✅ サブエージェント設定が完了しました');
      this.displaySubagentSummary();
      
      return {
        success: true,
        config: this.config
      };
    } catch (error) {
      rl.close();
      return {
        success: false,
        message: `Subagent configuration failed: ${error}`
      };
    }
  }

  /**
   * Configure notification settings
   * Be Lazy: Smart defaults with minimal user interaction
   */
  async configureNotifications(): Promise<ConfigurationResult> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      console.log('\n🔔 通知設定');
      
      const success = await this.askYesNo(rl,
        '✅ 成功時の通知を有効にしますか？ [Y/n]: ');
      
      const warnings = await this.askYesNo(rl,
        '⚠️ 警告時の通知を有効にしますか？ [Y/n]: ');
      
      const detailed = await this.askYesNo(rl,
        '📊 詳細結果の表示を有効にしますか？ [y/N]: ', false);

      this.config.notifications = {
        success,
        warnings,
        detailed
      };

      rl.close();
      
      console.log('\n✅ 通知設定が完了しました');
      
      return {
        success: true,
        config: this.config
      };
    } catch (error) {
      rl.close();
      return {
        success: false,
        message: `Notification configuration failed: ${error}`
      };
    }
  }

  /**
   * Get the current configuration
   * TypeScript First: Type-safe configuration access
   */
  getConfiguration(): GitConfig {
    return { ...this.config };
  }

  /**
   * Process watch pattern choice
   * Fail Fast: Immediate validation of pattern choices
   */
  private async processWatchPatternChoice(rl: readline.Interface, choice: string): Promise<ConfigurationResult> {
    switch (choice.trim()) {
      case '1':
        // Keep current settings
        console.log('✅ 現在の設定を維持します');
        return {
          success: true,
          config: this.config
        };
        
      case '2':
        this.config.paths = ['**/*', '!node_modules/**', '!.git/**', '!dist/**', '!build/**'];
        console.log('✅ プロジェクト全体を監視対象に設定しました');
        return {
          success: true,
          config: this.config
        };
        
      case '3':
        return await this.configureCustomPatterns(rl);
        
      default:
        console.log('🔄 デフォルト設定を使用します');
        return {
          success: true,
          config: this.config
        };
    }
  }

  /**
   * Configure custom watch patterns
   * Be Lazy: Smart validation and auto-completion
   */
  private async configureCustomPatterns(rl: readline.Interface): Promise<ConfigurationResult> {
    try {
      const customPath = await this.askQuestion(rl, 
        'カスタムパターンを入力してください (例: src/**/*,*.md): ');
      
      if (!customPath.trim()) {
        console.log('❌ 無効なパターンです。デフォルト設定を使用します');
        return {
          success: true,
          config: this.config
        };
      }

      const patterns = customPath.split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0);
      
      if (patterns.length === 0) {
        console.log('❌ 有効なパターンがありません。デフォルト設定を使用します');
        return {
          success: true,
          config: this.config
        };
      }

      // Add common ignore patterns
      this.config.paths = [...patterns, '!node_modules/**', '!.git/**'];
      console.log('✅ カスタムパターンを設定しました:', patterns.join(', '));
      
      return {
        success: true,
        config: this.config
      };
    } catch (error) {
      return {
        success: false,
        message: `Custom pattern configuration failed: ${error}`
      };
    }
  }

  /**
   * Ask a question and wait for user input
   * Fail Fast: Robust error handling for user input
   */
  private askQuestion(rl: readline.Interface, question: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let isCompleted = false;
      
      const cleanup = () => {
        if (!isCompleted) {
          isCompleted = true;
        }
      };
      
      const timeout = setTimeout(() => {
        if (!isCompleted) {
          cleanup();
          reject(new Error('Input timeout'));
        }
      }, 30000); // 30 second timeout
      
      rl.question(question, (answer) => {
        if (!isCompleted) {
          clearTimeout(timeout);
          cleanup();
          resolve(answer.trim());
        }
      });
      
      rl.on('error', (error) => {
        if (!isCompleted) {
          clearTimeout(timeout);
          cleanup();
          reject(error);
        }
      });
    });
  }

  /**
   * Ask a yes/no question
   * TypeScript First: Boolean return type with default handling
   */
  private async askYesNo(rl: readline.Interface, question: string, defaultValue = true): Promise<boolean> {
    try {
      const answer = await this.askQuestion(rl, question);
      const normalized = answer.toLowerCase();
      
      if (normalized === '' || normalized === 'y' || normalized === 'yes') {
        return defaultValue;
      }
      
      if (normalized === 'n' || normalized === 'no') {
        return !defaultValue;
      }
      
      return defaultValue;
    } catch (error) {
      console.warn('⚠️ 入力エラー、デフォルト値を使用します:', defaultValue);
      return defaultValue;
    }
  }

  /**
   * Ask user to choose from multiple options
   * Be Lazy: Simplified choice selection with smart defaults
   */
  private async askChoice(rl: readline.Interface, question: string, choices: string[], defaultChoice: string): Promise<string> {
    try {
      const choiceText = choices.map((choice, index) => `  ${index + 1}. ${choice}`).join('\n');
      const fullQuestion = `${question}\n${choiceText}\n選択 (1-${choices.length}): `;
      
      const answer = await this.askQuestion(rl, fullQuestion);
      const choiceIndex = parseInt(answer) - 1;
      
      if (choiceIndex >= 0 && choiceIndex < choices.length) {
        return choices[choiceIndex] || defaultChoice;
      }
      
      console.log(`無効な選択です。デフォルト値を使用します: ${defaultChoice}`);
      return defaultChoice;
    } catch (error) {
      console.warn('⚠️ 選択エラー、デフォルト値を使用します:', defaultChoice);
      return defaultChoice;
    }
  }

  /**
   * Display subagent configuration summary
   * TypeScript First: Type-safe configuration display
   */
  private displaySubagentSummary(): void {
    console.log('\n📋 サブエージェント設定サマリー:');
    
    const { subAgents } = this.config;
    
    console.log(`  🛡️ Git Safety Analyzer: ${subAgents.gitSafetyAnalyzer.enabled ? '✅' : '❌'}`);
    if (subAgents.gitSafetyAnalyzer.enabled) {
      console.log(`     - 安全性閾値: ${subAgents.gitSafetyAnalyzer.safetyThreshold}`);
    }
    
    console.log(`  📝 Commit Message Generator: ${subAgents.commitMessageGenerator.enabled ? '✅' : '❌'}`);
    if (subAgents.commitMessageGenerator.enabled) {
      console.log(`     - 言語: ${subAgents.commitMessageGenerator.language}`);
      console.log(`     - スタイル: ${subAgents.commitMessageGenerator.style}`);
    }
    
    console.log(`  🔀 PR Management Agent: ${subAgents.prManagementAgent.enabled ? '✅' : '❌'}`);
    if (subAgents.prManagementAgent.enabled) {
      console.log(`     - 自動マージ閾値: ${subAgents.prManagementAgent.autoMergeThreshold}`);
    }
  }
}