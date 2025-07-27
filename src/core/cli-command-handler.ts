/**
 * CLI Command Handler Module
 * Handles all command-line interface operations following Constitutional AI principles
 */

import { join } from 'path';
import { promises as fs } from 'fs';
import { GitConfig } from '../types/index.js';
import { GitAutoMCP } from './git-auto-mcp.js';
import { SetupWizard } from './setup-wizard.js';
import { ConstitutionalAIChecker } from './constitutional-ai-checker.js';
import { ProjectProgressTracker } from './project-progress-tracker.js';

export interface CommandResult {
  success: boolean;
  message?: string;
  exitCode?: number;
}

export class CLICommandHandler {
  private gitAutoMCP: GitAutoMCP;

  constructor(gitAutoMCP: GitAutoMCP) {
    this.gitAutoMCP = gitAutoMCP;
  }

  /**
   * Parse and execute CLI commands
   * Fail Fast: Immediate validation of command arguments
   * Be Lazy: Efficient command routing without redundant processing
   * TypeScript First: Complete type safety for all command operations
   */
  async executeCommand(args: string[]): Promise<CommandResult> {
    const command = args[0];

    try {
      switch (command) {
        case 'watch':
          return await this.handleWatchCommand();

        case 'commit':
          return await this.handleCommitCommand(args.slice(1));

        case 'status':
          return await this.handleStatusCommand();

        case 'init':
          return await this.handleInitCommand();

        case 'token':
        case 'setup-token':
          return this.handleTokenCommand();

        case 'setup':
        case 'wizard':
          return await this.handleSetupCommand();

        case 'constitutional':
        case 'check':
          return await this.handleConstitutionalCommand(args.slice(1));

        case 'progress':
        case 'ppt':
          return await this.handleProgressCommand(args.slice(1));

        default:
          return this.handleHelpCommand();
      }
    } catch (error) {
      console.error('❌ コマンド実行エラー:', error);
      return {
        success: false,
        message: `Command execution failed: ${error}`,
        exitCode: 3
      };
    }
  }

  private async handleWatchCommand(): Promise<CommandResult> {
    await this.gitAutoMCP.initialize();
    await this.gitAutoMCP.startWatching();
    return { success: true };
  }

  private async handleCommitCommand(files: string[]): Promise<CommandResult> {
    await this.gitAutoMCP.runOnce(files.length > 0 ? files : undefined);
    return { success: true };
  }

  private async handleStatusCommand(): Promise<CommandResult> {
    await this.gitAutoMCP.initialize();
    const status = await this.gitAutoMCP.getStatus();
    
    console.log('📊 システム状態:');
    console.log(`  有効: ${status.enabled ? '✅' : '❌'}`);
    console.log(`  監視中: ${status.watching ? '✅' : '❌'}`);
    console.log(`  処理中: ${status.processing ? '⏳' : '✅'}`);
    console.log(`  エージェント: ${status.agents.join(', ')}`);
    
    return { success: true };
  }

  private async handleInitCommand(): Promise<CommandResult> {
    console.log('🔧 設定ファイルを作成します...');
    const configPath = join(process.cwd(), 'git-auto-mcp.config.js');
    const configTemplate = this.generateConfigTemplate();
    
    try {
      await fs.writeFile(configPath, configTemplate);
      console.log(`✅ 設定ファイルを作成しました: ${configPath}`);
      
      this.displayTokenSetupGuide();
      
      return { success: true };
    } catch (error) {
      console.error('❌ 設定ファイルの作成に失敗しました:', error);
      return { 
        success: false, 
        message: `Config file creation failed: ${error}`,
        exitCode: 2 
      };
    }
  }

  private handleTokenCommand(): CommandResult {
    this.displayTokenSetupGuide();
    return { success: true };
  }

  private async handleSetupCommand(): Promise<CommandResult> {
    console.log('🧙‍♂️ セットアップウィザードを開始します...\n');
    const wizard = new SetupWizard();
    
    try {
      const result = await wizard.run();
      if (result.success) {
        console.log('\n🎉 セットアップが正常に完了しました！');
        console.log('github-auto-git watch でファイル監視を開始できます。');
        return { success: true };
      } else {
        console.log('\n❌ セットアップに失敗しました。');
        console.log('手動設定を行うか、github-auto-git init を試してください。');
        return { success: false, exitCode: 2 };
      }
    } catch (error) {
      console.error('❌ ウィザード実行エラー:', error);
      return { 
        success: false, 
        message: `Setup wizard failed: ${error}`,
        exitCode: 3 
      };
    }
  }

  private async handleConstitutionalCommand(args: string[]): Promise<CommandResult> {
    console.log('🏛️ Constitutional AI Checker を実行します...\n');
    const checker = new ConstitutionalAIChecker();
    
    try {
      const checkResult = await checker.runComprehensiveCheck({
        files: args.filter(arg => !arg.startsWith('-')),
        operation: 'manual-check',
        metadata: { manual: true }
      });
      
      this.displayConstitutionalResults(checkResult);
      
      const exitCode = checkResult.overallScore >= 80 ? 0 : 
                      checkResult.overallScore >= 60 ? 1 : 2;
      
      return { success: true, exitCode };
    } catch (error) {
      console.error('❌ Constitutional AI Checker エラー:', error);
      return { 
        success: false, 
        message: `Constitutional check failed: ${error}`,
        exitCode: 3 
      };
    }
  }

  private async handleProgressCommand(args: string[]): Promise<CommandResult> {
    console.log('📊 Project Progress Tracker を実行します...\n');
    const tracker = new ProjectProgressTracker();
    
    try {
      const progressResult = await tracker.updateProgress({
        type: 'task_completed',
        description: 'Manual progress check',
        filesChanged: args.filter(arg => !arg.startsWith('-')),
        impact: 'medium'
      });
      
      this.displayProgressResults(progressResult);
      
      return { success: true };
    } catch (error) {
      console.error('❌ Progress Tracker エラー:', error);
      return { 
        success: false, 
        message: `Progress tracking failed: ${error}`,
        exitCode: 3 
      };
    }
  }

  private handleHelpCommand(): CommandResult {
    console.log(`
🚀 GitHub MCP Auto Git System

使用方法:
  github-auto-git setup         🧙‍♂️ インタラクティブセットアップウィザード（推奨）
  github-auto-git watch         ファイル監視を開始
  github-auto-git commit [files] 手動でGit操作実行
  github-auto-git status        システム状態を表示
  github-auto-git init          設定ファイルを作成
  github-auto-git token         GITHUB_TOKEN設定ガイド表示
  github-auto-git check [files] 🏛️ Constitutional AI原則チェック実行
  github-auto-git progress      📊 Project Progress Tracker実行

サブエージェント機能:
  🛡️ Git Safety Analyzer       機密情報・破壊的変更検出
  📝 Commit Message Generator  非エンジニア向けメッセージ生成
  🔀 PR Management Agent       自動マージ判定・PR管理
  🏛️ Constitutional AI Checker  3原則（Fail Fast, Be Lazy, TypeScript First）チェック
  📊 Project Progress Tracker  進捗ドキュメント自動管理・インサイト生成

例:
  # ファイル監視開始（推奨）
  github-auto-git watch
  
  # 特定ファイルを手動コミット
  github-auto-git commit src/components/Header.tsx
  
  # 全変更を手動コミット
  github-auto-git commit
    `);
    
    return { success: true };
  }

  /**
   * Generate configuration template
   * Be Lazy: Reusable template generation
   */
  private generateConfigTemplate(): string {
    return `module.exports = {
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
  }

  /**
   * Display comprehensive token setup guide
   * Fail Fast: Clear validation requirements upfront
   */
  private displayTokenSetupGuide(): void {
    console.log('\n🔧 GITHUB_TOKEN 設定ガイド');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log('\n📋 ステップ1: GitHubでPersonal Access Tokenを作成');
    console.log('   1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)');
    console.log('   2. "Generate new token (classic)" をクリック');
    console.log('   3. Note: "GitHub MCP Auto Git System" など分かりやすい名前');
    console.log('   4. 必要な権限を選択:');
    console.log('      ✅ repo (リポジトリ全体へのアクセス)');
    console.log('      ✅ workflow (GitHub Actionsワークフロー)');
    console.log('      ✅ write:packages (パッケージ書き込み、オプション)');
    console.log('   5. "Generate token" をクリックして保存');
    
    console.log('\n📋 ステップ2: 環境変数を設定');
    console.log('   プロジェクトルートに .env ファイルを作成:');
    console.log('   ');
    console.log('   GITHUB_OWNER=your-username     # GitHubユーザー名');
    console.log('   GITHUB_REPO=your-repository    # リポジトリ名');
    console.log('   GITHUB_TOKEN=ghp_xxxxxxxxxxxx  # 作成したトークン');
    console.log('   ');
    
    console.log('📋 ステップ3: 動作確認');
    console.log('   github-auto-git status で設定確認');
    console.log('   GITHUB_TOKEN警告が消えれば設定完了');
    
    console.log('\n🔒 セキュリティ注意事項:');
    console.log('   • .env ファイルを .gitignore に追加してください');
    console.log('   • トークンは他人と共有しないでください');
    console.log('   • 不要になったら GitHub でトークンを削除してください');
    
    console.log('\n💡 その他:');
    console.log('   • OpenAI APIキーは不要です（Claude Codeサブエージェント機能を使用）');
    console.log('   • GITHUB_TOKENがない場合でもローカルGit操作は可能です');
    console.log('   • PR作成・マージ機能のみトークンが必要です');
    
    console.log('\n🌐 参考リンク:');
    console.log('   • GitHub Personal Access Token作成: https://github.com/settings/tokens');
    console.log('   • GitHub docs: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token');
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  /**
   * Display Constitutional AI check results
   * TypeScript First: Strongly typed result display
   */
  private displayConstitutionalResults(checkResult: any): void {
    console.log('\n📊 Constitutional AI Checker 結果:');
    console.log(`  総合スコア: ${checkResult.overallScore}/100`);
    console.log(`  Fail Fast: ${checkResult.principleScores.failFast}/100`);
    console.log(`  Be Lazy: ${checkResult.principleScores.beLazy}/100`);
    console.log(`  TypeScript First: ${checkResult.principleScores.typeScriptFirst}/100`);
    
    if (checkResult.violations.length > 0) {
      console.log(`\n⚠️ 検出された違反: ${checkResult.violations.length}件`);
      checkResult.violations.slice(0, 5).forEach((violation: any) => {
        console.log(`  • [${violation.severity.toUpperCase()}] ${violation.description}`);
      });
      if (checkResult.violations.length > 5) {
        console.log(`  • ... 他 ${checkResult.violations.length - 5} 件`);
      }
    }
    
    if (checkResult.recommendations.length > 0) {
      console.log('\n💡 推奨事項:');
      checkResult.recommendations.slice(0, 3).forEach((rec: string) => {
        console.log(`  • ${rec}`);
      });
    }
    
    console.log(`\n実行時間: ${checkResult.executionTime}ms`);
  }

  /**
   * Display progress tracking results
   * Be Lazy: Efficient result formatting
   */
  private displayProgressResults(progressResult: any): void {
    console.log('\n📈 Project Progress Report:');
    console.log(`  プロジェクト: ${progressResult.metrics.projectName} v${progressResult.metrics.version}`);
    console.log(`  進捗: ${progressResult.metrics.completedTasks}/${progressResult.metrics.totalTasks} (${progressResult.metrics.completionPercentage}%)`);
    console.log(`  品質スコア: ${progressResult.metrics.codeQualityScore}/100`);
    console.log(`  テストカバレッジ: ${progressResult.metrics.testCoverage}%`);
    console.log(`  ドキュメント: ${progressResult.metrics.documentationCoverage}%`);
    
    console.log('\n📊 Insights:');
    console.log(`  生産性: ${progressResult.insights.productivity}`);
    console.log(`  品質: ${progressResult.insights.quality}`);
    console.log(`  開発速度: ${progressResult.insights.velocity}`);
    
    if (progressResult.insights.recommendations.length > 0) {
      console.log('\n💡 推奨事項:');
      progressResult.insights.recommendations.slice(0, 3).forEach((rec: string) => {
        console.log(`  • ${rec}`);
      });
    }
    
    console.log(`\n📄 詳細レポートが生成されました: docs/progress/`);
  }
}