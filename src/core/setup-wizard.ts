/**
 * ユーザー向けセットアップウィザード
 * 初心者にやさしいインタラクティブな設定ガイド
 */

import * as readline from 'readline';
import { promises as fs } from 'fs';
import { join } from 'path';
import { GitConfig } from '../types/index.js';

export interface SetupResult {
  success: boolean;
  configPath?: string;
  envPath?: string;
  warnings?: string[];
  nextSteps?: string[];
}

export class SetupWizard {
  private projectPath: string;

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath;
  }


  /**
   * メインのセットアップウィザード実行
   */
  async run(): Promise<SetupResult> {
    try {
      console.log('\n🚀 GitHub MCP Auto Git System セットアップウィザード');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('このウィザードで簡単にセットアップが完了します!\n');

      // ステップ 1: プロジェクト確認
      await this.confirmProject();

      // ステップ 2: 機能選択
      const features = await this.selectFeatures();

      // ステップ 3: 監視設定
      const watchConfig = await this.configureWatching();

      // ステップ 4: GitHub設定（必要な場合）
      let githubConfig = null;
      if (features.enablePR || features.enableAutoMerge) {
        githubConfig = await this.configureGitHub();
      }

      // ステップ 5: サブエージェント設定
      const agentConfig = await this.configureAgents();

      // ステップ 6: 設定ファイル生成
      const configResult = await this.generateConfigFiles({
        features,
        watchConfig,
        githubConfig,
        agentConfig
      });

      // ステップ 7: 最終確認とテスト
      await this.finalConfirmation(configResult);

      return configResult;

    } catch (error) {
      console.error('❌ セットアップ中にエラーが発生しました:', error);
      return { success: false };
    } finally {
      // ReadlineInterfaceは各メソッドで個別管理
    }
  }

  /**
   * ステップ 1: プロジェクト確認
   */
  private async confirmProject(): Promise<void> {
    console.log('📁 ステップ 1: プロジェクト確認');
    console.log(`現在のディレクトリ: ${this.projectPath}`);
    
    // package.jsonの存在確認
    try {
      const packageJsonPath = join(this.projectPath, 'package.json');
      await fs.access(packageJsonPath);
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      console.log(`✅ プロジェクト名: ${packageJson.name || '未設定'}`);
      console.log(`✅ プロジェクト言語: ${packageJson.dependencies?.typescript ? 'TypeScript' : 'JavaScript'}`);
    } catch {
      console.log('ℹ️  package.json が見つかりません（Node.js以外のプロジェクトでも使用可能）');
    }

    // .gitの存在確認
    try {
      await fs.access(join(this.projectPath, '.git'));
      console.log('✅ Gitリポジトリが初期化済み');
    } catch {
      console.log('⚠️ Gitリポジトリが未初期化です');
      const initGit = await this.askQuestion('Git リポジトリを初期化しますか？ (y/n): ');
      if (initGit.toLowerCase() === 'y') {
        console.log('\n📋 以下のコマンドを実行してください:');
        console.log('   git init');
        console.log('   git add .');
        console.log('   git commit -m "Initial commit"');
        console.log('\nGit初期化後、再度セットアップを実行してください。');
        process.exit(0);
      }
    }

    console.log('\n✅ プロジェクト確認完了\n');
  }

  /**
   * ステップ 2: 機能選択
   */
  private async selectFeatures(): Promise<{
    enableAutoCommit: boolean;
    enablePR: boolean;
    enableAutoMerge: boolean;
    enableSafetyCheck: boolean;
    enableSmartMessages: boolean;
  }> {
    console.log('🎯 ステップ 2: 使用する機能を選択');
    console.log('必要な機能を選択してください（後で変更可能）:\n');

    const enableAutoCommit = await this.askYesNo(
      '📝 自動コミット機能を有効にしますか？\n' +
      '   → ファイル保存時に自動的にGitコミットを実行'
    );

    const enableSafetyCheck = await this.askYesNo(
      '🛡️ 安全性チェック機能を有効にしますか？\n' +
      '   → 機密情報の検出、破壊的変更の防止'
    );

    const enableSmartMessages = await this.askYesNo(
      '🤖 スマートなコミットメッセージ生成を有効にしますか？\n' +
      '   → AI による分かりやすいメッセージ自動生成'
    );

    const enablePR = await this.askYesNo(
      '🔀 プルリクエスト自動作成を有効にしますか？\n' +
      '   → GitHub への自動PR作成（GITHUB_TOKEN必要）'
    );

    let enableAutoMerge = false;
    if (enablePR) {
      enableAutoMerge = await this.askYesNo(
        '⚡ 自動マージ機能を有効にしますか？\n' +
        '   → 条件を満たした場合の自動PR マージ（注意が必要）'
      );
    }

    console.log('\n✅ 機能選択完了\n');
    return {
      enableAutoCommit,
      enablePR,
      enableAutoMerge,
      enableSafetyCheck,
      enableSmartMessages
    };
  }

  /**
   * ステップ 3: 監視設定
   */
  private async configureWatching(): Promise<{
    patterns: string[];
    excludePatterns: string[];
  }> {
    console.log('👀 ステップ 3: ファイル監視設定');
    console.log('監視対象のファイル・フォルダを設定します:\n');

    const scope = await this.askChoice(
      '監視する範囲を選択してください:',
      [
        { key: '1', label: 'プロジェクト全体 (推奨)', description: '全てのファイルを監視' },
        { key: '2', label: 'src フォルダのみ', description: 'src/ 以下のファイルのみ監視' },
        { key: '3', label: 'カスタム設定', description: '独自のパターンを指定' }
      ]
    );

    let patterns: string[];
    const excludePatterns: string[] = ['node_modules/**', '.git/**', 'dist/**', 'build/**', '**/*.log'];

    switch (scope) {
      case '1':
        patterns = ['**/*'];
        break;
      case '2':
        patterns = ['src/**/*'];
        break;
      case '3':
        const customPattern = await this.askQuestion(
          '監視パターンを入力してください (例: src/**/*,*.md): '
        );
        patterns = customPattern.split(',').map(p => p.trim()).filter(p => p.length > 0);
        break;
      default:
        patterns = ['src/**/*'];
    }

    console.log('\n📋 監視設定確認:');
    console.log(`   監視対象: ${patterns.join(', ')}`);
    console.log(`   除外対象: ${excludePatterns.join(', ')}`);

    console.log('\n✅ 監視設定完了\n');
    return { patterns, excludePatterns };
  }

  /**
   * ステップ 4: GitHub設定
   */
  private async configureGitHub(): Promise<{
    owner: string;
    repo: string;
    token?: string;
    setupToken: boolean;
  } | null> {
    console.log('🔗 ステップ 4: GitHub連携設定');
    console.log('PR機能を使用するためのGitHub設定を行います:\n');

    const owner = await this.askQuestion('GitHubユーザー名またはOrganization名: ');
    const repo = await this.askQuestion('リポジトリ名: ');

    console.log('\n🔑 GITHUB_TOKEN の設定');
    console.log('PR作成・マージにはGitHub Personal Access Tokenが必要です。\n');

    const tokenChoice = await this.askChoice(
      'トークンの設定方法を選択してください:',
      [
        { key: '1', label: '今すぐ設定', description: 'トークンを入力して .env に保存' },
        { key: '2', label: '後で設定', description: '設定方法を表示して後で手動設定' },
        { key: '3', label: 'スキップ', description: 'ローカルGit機能のみ使用' }
      ]
    );

    let token: string | undefined;
    let setupToken = false;

    switch (tokenChoice) {
      case '1':
        console.log('\n🔧 トークン作成ガイド:');
        console.log('1. https://github.com/settings/tokens にアクセス');
        console.log('2. "Generate new token (classic)" をクリック');
        console.log('3. 必要な権限を選択: repo, workflow');
        console.log('4. トークンを生成してコピー\n');
        
        token = await this.askQuestion('GITHUB_TOKEN を入力してください: ');
        setupToken = true;
        break;
        
      case '2':
        console.log('\n📋 後で設定する場合:');
        console.log('1. https://github.com/settings/tokens でトークンを作成');
        console.log('2. プロジェクトルートに .env ファイルを作成');
        console.log('3. 以下の内容を追加:');
        console.log(`   GITHUB_OWNER=${owner}`);
        console.log(`   GITHUB_REPO=${repo}`);
        console.log('   GITHUB_TOKEN=your_token_here');
        setupToken = false;
        break;
        
      case '3':
        console.log('\n⏭️ GitHub連携をスキップします');
        console.log('ローカルGit機能のみが有効になります。');
        return null;
    }

    console.log('\n✅ GitHub設定完了\n');
    return { owner, repo, token, setupToken };
  }

  /**
   * ステップ 5: サブエージェント設定
   */
  private async configureAgents(): Promise<{
    gitSafetyAnalyzer: { enabled: boolean; threshold: number };
    commitMessageGenerator: { enabled: boolean; language: string; style: string };
    prManagementAgent: { enabled: boolean; autoMergeThreshold: number };
  }> {
    console.log('🤖 ステップ 5: サブエージェント詳細設定');
    console.log('各サブエージェントの動作を調整します:\n');

    // 簡略化されたエージェント設定
    const safetyEnabled = await this.askYesNo('🛡️ Git Safety Analyzer を有効にしますか？');
    const messageEnabled = await this.askYesNo('📝 Commit Message Generator を有効にしますか？');
    const prEnabled = await this.askYesNo('🔀 PR Management Agent を有効にしますか？');

    console.log('\n✅ サブエージェント設定完了\n');
    return {
      gitSafetyAnalyzer: { enabled: safetyEnabled, threshold: 0.85 },
      commitMessageGenerator: { enabled: messageEnabled, language: 'ja', style: 'friendly' },
      prManagementAgent: { enabled: prEnabled, autoMergeThreshold: 0.85 }
    };
  }

  /**
   * ステップ 6: 設定ファイル生成
   */
  private async generateConfigFiles(config: any): Promise<SetupResult> {
    console.log('📄 ステップ 6: 設定ファイル生成');
    console.log('設定に基づいてファイルを作成します:\n');

    const warnings: string[] = [];
    const nextSteps: string[] = [];

    try {
      // git-auto-mcp.config.js の生成
      const configPath = join(this.projectPath, 'git-auto-mcp.config.js');
      const configContent = this.generateConfigFileContent(config);
      
      await fs.writeFile(configPath, configContent);
      console.log(`✅ 設定ファイル作成: ${configPath}`);

      // .env ファイルの生成（必要な場合）
      let envPath: string | undefined;
      if (config.githubConfig?.setupToken) {
        envPath = join(this.projectPath, '.env');
        const envContent = this.generateEnvFileContent(config.githubConfig);
        
        await fs.writeFile(envPath, envContent);
        console.log(`✅ 環境変数ファイル作成: ${envPath}`);
        
        warnings.push('.env ファイルを .gitignore に追加することを強く推奨します');
      }

      // 次のステップの提案
      nextSteps.push('github-auto-git status で設定を確認');
      nextSteps.push('github-auto-git watch でファイル監視を開始');
      
      if (config.githubConfig && !config.githubConfig.setupToken) {
        nextSteps.push('github-auto-git token でGITHUB_TOKEN設定方法を確認');
      }

      console.log('\n✅ 設定ファイル生成完了\n');
      return {
        success: true,
        configPath,
        envPath,
        warnings,
        nextSteps
      };

    } catch (error) {
      console.error('❌ 設定ファイル生成に失敗:', error);
      return { success: false };
    }
  }

  /**
   * ステップ 7: 最終確認
   */
  private async finalConfirmation(result: SetupResult): Promise<void> {
    console.log('🎉 ステップ 7: セットアップ完了');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (result.success) {
      console.log('✅ GitHub MCP Auto Git System のセットアップが完了しました!\n');
      
      if (result.warnings && result.warnings.length > 0) {
        console.log('⚠️ 注意事項:');
        result.warnings.forEach(warning => console.log(`   • ${warning}`));
        console.log('');
      }
      
      if (result.nextSteps && result.nextSteps.length > 0) {
        console.log('📋 次のステップ:');
        result.nextSteps.forEach((step, index) => {
          console.log(`   ${index + 1}. ${step}`);
        });
        console.log('');
      }
      
      console.log('💡 ヘルプとドキュメント:');
      console.log('   • github-auto-git --help で全コマンドを表示');
      console.log('   • github-auto-git token でGitHub設定ガイドを表示');
      
      console.log('\n🚀 使用開始:');
      console.log('   github-auto-git watch');
      
    } else {
      console.log('❌ セットアップに失敗しました。');
      console.log('手動設定を行うか、再度ウィザードを実行してください。');
    }
  }

  /**
   * 設定ファイルの内容生成
   */
  private generateConfigFileContent(config: any): string {
    const patterns = config.watchConfig.patterns.concat(
      config.watchConfig.excludePatterns.map((p: string) => `!${p}`)
    );
    
    return `module.exports = {
  enabled: true,
  triggers: ['save', 'auto'],
  paths: ${JSON.stringify(patterns, null, 4)},
  subAgents: {
    gitSafetyAnalyzer: {
      enabled: ${config.agentConfig.gitSafetyAnalyzer.enabled},
      safetyThreshold: ${config.agentConfig.gitSafetyAnalyzer.threshold}
    },
    commitMessageGenerator: {
      enabled: ${config.agentConfig.commitMessageGenerator.enabled},
      language: '${config.agentConfig.commitMessageGenerator.language}',
      style: '${config.agentConfig.commitMessageGenerator.style}'
    },
    prManagementAgent: {
      enabled: ${config.agentConfig.prManagementAgent.enabled},
      autoMergeThreshold: ${config.agentConfig.prManagementAgent.autoMergeThreshold}
    }
  },
  notifications: {
    success: true,
    warnings: true,
    detailed: false
  },
  github: {
    owner: process.env.GITHUB_OWNER || '${config.githubConfig?.owner || ''}',
    repo: process.env.GITHUB_REPO || '${config.githubConfig?.repo || ''}',
    token: process.env.GITHUB_TOKEN || ''
  }
};
`;
  }

  /**
   * .env ファイルの内容生成
   */
  private generateEnvFileContent(githubConfig: any): string {
    return `# GitHub MCP Auto Git System 設定
# このファイルは .gitignore に追加してください

GITHUB_OWNER=${githubConfig.owner}
GITHUB_REPO=${githubConfig.repo}
GITHUB_TOKEN=${githubConfig.token || 'your_token_here'}

# 追加の環境変数があればここに記載
`;
  }

  /**
   * ユーティリティメソッド
   */
  private async askQuestion(question: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      let isCompleted = false;
      
      const cleanup = () => {
        if (!isCompleted) {
          isCompleted = true;
          try {
            rl.close();
          } catch (error) {
            // ReadlineInterface already closed - ignore error
          }
        }
      };
      
      rl.question(question, (answer) => {
        if (!isCompleted) {
          cleanup();
          resolve(answer.trim());
        }
      });
      
      // エラーハンドリング
      rl.on('error', (error) => {
        if (!isCompleted) {
          cleanup();
          reject(error);
        }
      });
      
      // プロセス終了時のクリーンアップ
      const sigintHandler = () => {
        if (!isCompleted) {
          cleanup();
          process.removeListener('SIGINT', sigintHandler);
          reject(new Error('User interrupted'));
        }
      };
      
      process.once('SIGINT', sigintHandler);
    });
  }
  
  private async askYesNo(question: string): Promise<boolean> {
    const answer = await this.askQuestion(`${question} (y/n): `);
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  }
  
  private async askChoice(question: string, choices: Array<{key: string, label: string, description?: string}>): Promise<string> {
    console.log(question);
    choices.forEach(choice => {
      const desc = choice.description ? ` - ${choice.description}` : '';
      console.log(`   ${choice.key}. ${choice.label}${desc}`);
    });
    
    let answer: string;
    do {
      answer = await this.askQuestion('選択してください: ');
    } while (!choices.some(choice => choice.key === answer));
    
    return answer;
  }
}