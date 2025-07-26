#!/usr/bin/env node

import { join } from 'path';
import { promises as fs } from 'fs';
import { watch } from 'chokidar';
import { config } from 'dotenv';
import { GitOperations } from './core/git-operations.js';
import { GitConfig } from './types/index.js';

config();

class GitAutoMCP {
  private gitOps: GitOperations;
  private config: GitConfig;
  private watcher?: ReturnType<typeof watch>;
  private debounceTimer?: NodeJS.Timeout;
  private isProcessing: boolean = false;

  constructor(configPath?: string) {
    this.config = {} as GitConfig; // 一時的な初期化
    this.gitOps = {} as GitOperations; // 一時的な初期化
    this.configPath = configPath;
  }

  private configPath?: string;

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

  async initialize(): Promise<void> {
    console.log('🚀 GitHub MCP Auto Git System を初期化しています...');
    
    try {
      this.config = await this.loadConfig(this.configPath);
      this.gitOps = new GitOperations(this.config);
      await this.gitOps.initialize();
      
      if (!this.config.github.token) {
        console.warn('⚠️ GITHUB_TOKEN が設定されていません。PR機能は無効になります。');
      }
      
      console.log('✅ 初期化完了');
      console.log('📁 監視パターン:', this.config.paths.join(', '));
      console.log('🤖 有効なサブエージェント:', this.getEnabledAgents().join(', '));
      
    } catch (error) {
      console.error('❌ 初期化に失敗しました:', error);
      process.exit(1);
    }
  }

  async startWatching(): Promise<void> {
    if (!this.config.enabled) {
      console.log('⏸️ システムが無効になっています');
      return;
    }

    console.log('👀 ファイル監視を開始します...');
    
    this.watcher = watch(this.config.paths, {
      ignored: /node_modules/,
      ignoreInitial: true,
      persistent: true
    });

    this.watcher
      .on('change', (path) => this.handleFileChange(path, 'change'))
      .on('add', (path) => this.handleFileChange(path, 'add'))
      .on('unlink', (path) => this.handleFileChange(path, 'delete'))
      .on('error', (error) => console.error('❌ ファイル監視エラー:', error));

    console.log('✅ ファイル監視が開始されました');
    console.log('💡 Ctrl+C で停止できます');
  }

  private async handleFileChange(filePath: string, type: 'change' | 'add' | 'delete'): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    console.log(`📝 ファイル${type === 'change' ? '変更' : type === 'add' ? '追加' : '削除'}: ${filePath}`);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      await this.processChanges([filePath]);
    }, 2000);
  }

  async processChanges(files?: string[]): Promise<void> {
    if (this.isProcessing) {
      console.log('⏳ 既に処理中です...');
      return;
    }

    this.isProcessing = true;

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
      } else {
        console.error('\n❌ Git操作が失敗しました:', result.message);
        
        if (result.warnings && result.warnings.length > 0) {
          console.log('\n詳細:');
          result.warnings.forEach(warning => console.log(`  • ${warning}`));
        }
      }

    } catch (error) {
      console.error('❌ 予期しないエラーが発生しました:', error);
    } finally {
      this.isProcessing = false;
      console.log(`\n⏱️ 処理時間: ${Date.now() - (Date.now() - 1000)}ms`);
      console.log('👀 ファイル監視を継続中...\n');
    }
  }

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

  async runOnce(files?: string[]): Promise<void> {
    await this.initialize();
    await this.processChanges(files);
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      console.log('⏹️ ファイル監視を停止しました');
    }
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }

  private getEnabledAgents(): string[] {
    const agents = [];
    if (this.config.subAgents.gitSafetyAnalyzer.enabled) agents.push('Git Safety Analyzer');
    if (this.config.subAgents.commitMessageGenerator.enabled) agents.push('Commit Message Generator');
    if (this.config.subAgents.prManagementAgent.enabled) agents.push('PR Management Agent');
    return agents;
  }

  getStatus(): {
    enabled: boolean;
    watching: boolean;
    processing: boolean;
    agents: string[];
    config: GitConfig;
  } {
    return {
      enabled: this.config.enabled,
      watching: !!this.watcher,
      processing: this.isProcessing,
      agents: this.getEnabledAgents(),
      config: this.config
    };
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  const gitAutoMCP = new GitAutoMCP();

  process.on('SIGINT', async () => {
    console.log('\n🛑 終了シグナルを受信しました...');
    await gitAutoMCP.stop();
    process.exit(0);
  });

  switch (command) {
    case 'watch':
      await gitAutoMCP.initialize();
      await gitAutoMCP.startWatching();
      break;

    case 'commit':
      const files = args.slice(1);
      await gitAutoMCP.runOnce(files.length > 0 ? files : undefined);
      break;

    case 'status':
      await gitAutoMCP.initialize();
      const status = gitAutoMCP.getStatus();
      console.log('📊 システム状態:');
      console.log(`  有効: ${status.enabled ? '✅' : '❌'}`);
      console.log(`  監視中: ${status.watching ? '✅' : '❌'}`);
      console.log(`  処理中: ${status.processing ? '⏳' : '✅'}`);
      console.log(`  エージェント: ${status.agents.join(', ')}`);
      break;

    case 'init':
      console.log('🔧 設定ファイルを作成します...');
      const configPath = join(process.cwd(), 'git-auto-mcp.config.js');
      const configTemplate = `module.exports = {
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
};`;
      
      try {
        await fs.writeFile(configPath, configTemplate);
        console.log(`✅ 設定ファイルを作成しました: ${configPath}`);
        console.log('💡 .env ファイルに以下の環境変数を設定してください:');
        console.log('  GITHUB_OWNER=your-username');
        console.log('  GITHUB_REPO=your-repo');
        console.log('  GITHUB_TOKEN=your-token');
        console.log('');
        console.log('💡 注意: OpenAI APIキーは不要です（Claude Codeサブエージェント機能を使用）');
      } catch (error) {
        console.error('❌ 設定ファイルの作成に失敗しました:', error);
      }
      break;

    default:
      console.log(`
🚀 GitHub MCP Auto Git System

使用方法:
  github-auto-git watch         ファイル監視を開始
  github-auto-git commit [files] 手動でGit操作実行
  github-auto-git status        システム状態を表示
  github-auto-git init          設定ファイルを作成

サブエージェント機能:
  🛡️ Git Safety Analyzer       機密情報・破壊的変更検出
  📝 Commit Message Generator  非エンジニア向けメッセージ生成
  🔀 PR Management Agent       自動マージ判定・PR管理

例:
  # ファイル監視開始（推奨）
  github-auto-git watch
  
  # 特定ファイルを手動コミット
  github-auto-git commit src/components/Header.tsx
  
  # 全変更を手動コミット
  github-auto-git commit
      `);
      break;
  }
}

// ESModuleでの実行判定（スクリプトとして直接実行された場合のみ）
import { fileURLToPath } from 'url';

const currentFile = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] && 
  (currentFile === process.argv[1] || 
   currentFile.endsWith(process.argv[1]) ||
   process.argv[1].endsWith('github-auto-git')); // グローバルインストール対応

if (isMainModule) {
  main().catch(error => {
    console.error('❌ 実行中にエラーが発生しました:', error);
    process.exit(1);
  });
}

export { GitAutoMCP };
export default GitAutoMCP;