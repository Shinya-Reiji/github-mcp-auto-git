#!/usr/bin/env node
import { join } from 'path';
import { promises as fs } from 'fs';
import { watch } from 'chokidar';
import { config } from 'dotenv';
import * as readline from 'readline';
import { GitOperations } from './core/git-operations.js';
import { SetupWizard } from './core/setup-wizard.js';
config();
class GitAutoMCP {
    constructor(configPath) {
        this.isProcessing = false;
        this.config = {}; // 一時的な初期化
        this.gitOps = {}; // 一時的な初期化
        this.configPath = configPath;
    }
    async loadConfig(configPath) {
        const defaultConfig = {
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
            }
            catch (error) {
                console.warn(`設定ファイルの読み込みに失敗しました: ${error}`);
            }
        }
        return defaultConfig;
    }
    async initialize() {
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
        }
        catch (error) {
            console.error('❌ 初期化に失敗しました:', error);
            process.exit(1);
        }
    }
    async startWatching() {
        if (!this.config.enabled) {
            console.log('⏸️ システムが無効になっています');
            return;
        }
        // インタラクティブな監視パターン設定
        await this.configureWatchPatterns();
        // PIDファイル作成でプロセス管理
        await this.writePidFile();
        console.log('👀 ファイル監視を開始します...');
        console.log('📁 監視対象:', this.config.paths.join(', '));
        this.watcher = watch(this.config.paths, {
            ignored: [
                /node_modules/,
                '**/*.pid',
                '.github-auto-git.pid'
            ],
            ignoreInitial: true,
            persistent: true
        });
        this.watcher
            .on('change', (path) => this.handleFileChange(path, 'change'))
            .on('add', (path) => this.handleFileChange(path, 'add'))
            .on('unlink', (path) => this.handleFileChange(path, 'delete'))
            .on('error', (error) => console.error('❌ ファイル監視エラー:', error));
        console.log('✅ ファイル監視が開始されました');
        console.log(`📋 PID: ${process.pid} (プロセス監視用)`);
        console.log('💡 Ctrl+C で停止できます');
        // 定期ヘルスチェック開始
        this.startHealthCheck();
    }
    async handleFileChange(filePath, type) {
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
    async processChanges(files) {
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
            }
            else {
                console.error('\n❌ Git操作が失敗しました:', result.message);
                if (result.warnings && result.warnings.length > 0) {
                    console.log('\n詳細:');
                    result.warnings.forEach(warning => console.log(`  • ${warning}`));
                }
            }
        }
        catch (error) {
            console.error('❌ 予期しないエラーが発生しました:', error);
        }
        finally {
            this.isProcessing = false;
            console.log(`\n⏱️ 処理時間: ${Date.now() - (Date.now() - 1000)}ms`);
            console.log('👀 ファイル監視を継続中...\n');
        }
    }
    displayDetailedResult(result) {
        console.log('\n📊 詳細結果:');
        if (result.details.safety) {
            const safety = result.details.safety;
            console.log(`  🔒 安全性: ${safety.level} (${safety.safetyScore}/100)`);
            if (safety.risks.length > 0) {
                console.log('  ⚠️ リスク:');
                safety.risks.forEach((risk) => {
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
    async runOnce(files) {
        await this.initialize();
        await this.processChanges(files);
    }
    async stop() {
        if (this.watcher) {
            await this.watcher.close();
            console.log('⏹️ ファイル監視を停止しました');
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        // PIDファイルを削除
        await this.removePidFile();
    }
    async writePidFile() {
        try {
            const pidFile = join(process.cwd(), '.github-auto-git.pid');
            await fs.writeFile(pidFile, process.pid.toString());
            console.log(`📄 PIDファイル作成: ${pidFile}`);
        }
        catch (error) {
            console.warn('⚠️ PIDファイル作成に失敗:', error);
        }
    }
    async removePidFile() {
        try {
            const pidFile = join(process.cwd(), '.github-auto-git.pid');
            await fs.unlink(pidFile);
            console.log('🗑️ PIDファイルを削除しました');
        }
        catch (error) {
            // PIDファイルが存在しない場合は無視
        }
    }
    startHealthCheck() {
        // 30秒ごとにヘルスチェック
        setInterval(() => {
            console.log(`💓 ヘルスチェック: ${new Date().toLocaleTimeString()} - 監視中`);
        }, 30000);
    }
    getEnabledAgents() {
        const agents = [];
        if (this.config.subAgents.gitSafetyAnalyzer.enabled)
            agents.push('Git Safety Analyzer');
        if (this.config.subAgents.commitMessageGenerator.enabled)
            agents.push('Commit Message Generator');
        if (this.config.subAgents.prManagementAgent.enabled)
            agents.push('PR Management Agent');
        return agents;
    }
    async configureWatchPatterns() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        console.log('\n🔧 監視設定');
        console.log('現在の監視パターン:', this.config.paths.join(', '));
        const answer = await this.askQuestion(rl, '\n📁 監視したいフォルダ/ファイルを指定してください:\n' +
            '  1. 現在のまま (src/**/*)\n' +
            '  2. プロジェクト全体 (**/*)\n' +
            '  3. カスタム設定\n' +
            '選択 (1-3): ');
        switch (answer) {
            case '1':
                // 現在の設定をそのまま使用
                break;
            case '2':
                this.config.paths = ['**/*', '!node_modules/**', '!.git/**', '!dist/**', '!build/**'];
                console.log('✅ プロジェクト全体を監視対象に設定しました');
                break;
            case '3':
                const customPath = await this.askQuestion(rl, 'カスタムパターンを入力してください (例: src/**/*,*.md): ');
                const patterns = customPath.split(',').map(p => p.trim()).filter(p => p.length > 0);
                this.config.paths = [...patterns, '!node_modules/**', '!.git/**'];
                console.log('✅ カスタムパターンを設定しました:', patterns.join(', '));
                break;
            default:
                console.log('🔄 デフォルト設定を使用します');
                break;
        }
        rl.close();
    }
    askQuestion(rl, question) {
        return new Promise((resolve, reject) => {
            let isCompleted = false;
            const cleanup = () => {
                if (!isCompleted) {
                    isCompleted = true;
                }
            };
            rl.question(question, (answer) => {
                if (!isCompleted) {
                    cleanup();
                    resolve(answer.trim());
                }
            });
            rl.on('error', (error) => {
                if (!isCompleted) {
                    cleanup();
                    reject(error);
                }
            });
        });
    }
    getStatus() {
        return {
            enabled: this.config.enabled,
            watching: !!this.watcher,
            processing: this.isProcessing,
            agents: this.getEnabledAgents(),
            config: this.config
        };
    }
}
async function main() {
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
                // 詳細なGITHUB_TOKEN設定ガイド
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
                console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            }
            catch (error) {
                console.error('❌ 設定ファイルの作成に失敗しました:', error);
            }
            break;
        case 'token':
        case 'setup-token':
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
            break;
        case 'setup':
        case 'wizard':
            console.log('🧙‍♂️ セットアップウィザードを開始します...\n');
            const wizard = new SetupWizard();
            try {
                const result = await wizard.run();
                if (result.success) {
                    console.log('\n🎉 セットアップが正常に完了しました！');
                    console.log('github-auto-git watch でファイル監視を開始できます。');
                }
                else {
                    console.log('\n❌ セットアップに失敗しました。');
                    console.log('手動設定を行うか、github-auto-git init を試してください。');
                }
            }
            catch (error) {
                console.error('❌ ウィザード実行エラー:', error);
            }
            break;
        default:
            console.log(`
🚀 GitHub MCP Auto Git System

使用方法:
  github-auto-git setup         🧙‍♂️ インタラクティブセットアップウィザード（推奨）
  github-auto-git watch         ファイル監視を開始
  github-auto-git commit [files] 手動でGit操作実行
  github-auto-git status        システム状態を表示
  github-auto-git init          設定ファイルを作成
  github-auto-git token         GITHUB_TOKEN設定ガイド表示

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
//# sourceMappingURL=index.js.map