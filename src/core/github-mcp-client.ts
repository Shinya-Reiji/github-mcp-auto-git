/**
 * GitHub MCP クライアント
 * @modelcontextprotocol/server-github との統合
 */

import { spawn, ChildProcess } from 'child_process';
import { GitConfig } from '../types/index.js';

export interface MCPGitHubResult {
  success: boolean;
  data?: any;
  error?: string;
  warnings?: string[];
}

export interface MCPPullRequestOptions {
  title: string;
  body: string;
  head: string;
  base: string;
  draft?: boolean;
  maintainer_can_modify?: boolean;
}

export interface MCPMergeOptions {
  pullNumber: number;
  mergeMethod?: 'merge' | 'squash' | 'rebase';
  commitTitle?: string;
  commitMessage?: string;
}

export class GitHubMCPClient {
  private mcpProcess: ChildProcess | null = null;
  private config: GitConfig;
  private isInitialized = false;

  constructor(config: GitConfig) {
    this.config = config;
  }

  /**
   * MCP サーバーを初期化
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔗 GitHub MCP サーバーを初期化中...');
      
      // GitHub MCP サーバーを起動
      this.mcpProcess = spawn('mcp-server-github', [], {
        env: {
          ...process.env,
          GITHUB_PERSONAL_ACCESS_TOKEN: this.config.github.token,
          GITHUB_OWNER: this.config.github.owner,
          GITHUB_REPO: this.config.github.repo
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (!this.mcpProcess.stdout || !this.mcpProcess.stderr) {
        throw new Error('MCP プロセスの stdio が利用できません');
      }

      // エラーハンドリング
      this.mcpProcess.on('error', (error) => {
        console.error('❌ GitHub MCP サーバーエラー:', error);
      });

      this.mcpProcess.stderr.on('data', (data) => {
        console.warn('⚠️ GitHub MCP 警告:', data.toString());
      });

      // 初期化完了を待機
      await this.waitForInitialization();
      
      this.isInitialized = true;
      console.log('✅ GitHub MCP サーバー初期化完了');
      
    } catch (error) {
      console.error('❌ GitHub MCP サーバー初期化失敗:', error);
      throw error;
    }
  }

  /**
   * プルリクエストを作成
   */
  async createPullRequest(options: MCPPullRequestOptions): Promise<MCPGitHubResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log(`🔀 MCP経由でPR作成: ${options.title}`);
      
      const request = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'create_pull_request',
          arguments: {
            owner: this.config.github.owner,
            repo: this.config.github.repo,
            title: options.title,
            body: options.body,
            head: options.head,
            base: options.base,
            draft: options.draft || false,
            maintainer_can_modify: options.maintainer_can_modify || true
          }
        }
      };

      const result = await this.sendMCPRequest(request);
      
      if (result.success && result.data?.content) {
        console.log(`✅ PR作成成功: #${result.data.content.number}`);
        return {
          success: true,
          data: {
            number: result.data.content.number,
            url: result.data.content.html_url
          }
        };
      }

      return {
        success: false,
        error: result.error || 'PR作成に失敗しました'
      };

    } catch (error) {
      console.error('❌ MCP PR作成エラー:', error);
      return {
        success: false,
        error: `MCP PR作成エラー: ${error}`
      };
    }
  }

  /**
   * プルリクエストをマージ
   */
  async mergePullRequest(options: MCPMergeOptions): Promise<MCPGitHubResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log(`🔀 MCP経由でPRマージ: #${options.pullNumber}`);
      
      const request = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'merge_pull_request',
          arguments: {
            owner: this.config.github.owner,
            repo: this.config.github.repo,
            pull_number: options.pullNumber,
            merge_method: options.mergeMethod || 'squash',
            commit_title: options.commitTitle,
            commit_message: options.commitMessage
          }
        }
      };

      const result = await this.sendMCPRequest(request);
      
      if (result.success) {
        console.log(`✅ PRマージ成功: #${options.pullNumber}`);
        return {
          success: true,
          data: result.data
        };
      }

      return {
        success: false,
        error: result.error || 'PRマージに失敗しました'
      };

    } catch (error) {
      console.error('❌ MCP PRマージエラー:', error);
      return {
        success: false,
        error: `MCP PRマージエラー: ${error}`
      };
    }
  }

  /**
   * プルリクエストのステータスを確認
   */
  async getPullRequestStatus(pullNumber: number): Promise<MCPGitHubResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const request = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'get_pull_request',
          arguments: {
            owner: this.config.github.owner,
            repo: this.config.github.repo,
            pull_number: pullNumber
          }
        }
      };

      const result = await this.sendMCPRequest(request);
      
      if (result.success && result.data?.content) {
        return {
          success: true,
          data: {
            state: result.data.content.state,
            mergeable: result.data.content.mergeable,
            mergeable_state: result.data.content.mergeable_state,
            merged: result.data.content.merged,
            checks_status: result.data.content.statuses || []
          }
        };
      }

      return {
        success: false,
        error: result.error || 'PR状態取得に失敗しました'
      };

    } catch (error) {
      console.error('❌ MCP PR状態確認エラー:', error);
      return {
        success: false,
        error: `MCP PR状態確認エラー: ${error}`
      };
    }
  }

  /**
   * ブランチを削除
   */
  async deleteBranch(branchName: string): Promise<MCPGitHubResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log(`🗑️ MCP経由でブランチ削除: ${branchName}`);
      
      const request = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: 'delete_branch',
          arguments: {
            owner: this.config.github.owner,
            repo: this.config.github.repo,
            ref: `heads/${branchName}`
          }
        }
      };

      const result = await this.sendMCPRequest(request);
      
      if (result.success) {
        console.log(`✅ ブランチ削除成功: ${branchName}`);
        return { success: true };
      }

      return {
        success: false,
        error: result.error || 'ブランチ削除に失敗しました'
      };

    } catch (error) {
      console.error('❌ MCP ブランチ削除エラー:', error);
      return {
        success: false,
        error: `MCP ブランチ削除エラー: ${error}`
      };
    }
  }

  /**
   * MCP リクエストを送信
   */
  private async sendMCPRequest(request: any): Promise<MCPGitHubResult> {
    return new Promise((resolve) => {
      if (!this.mcpProcess?.stdin || !this.mcpProcess?.stdout) {
        resolve({
          success: false,
          error: 'MCP プロセスが利用できません'
        });
        return;
      }

      let responseData = '';
      
      const onData = (data: Buffer) => {
        responseData += data.toString();
        try {
          const response = JSON.parse(responseData);
          this.mcpProcess!.stdout!.off('data', onData);
          
          if (response.error) {
            resolve({
              success: false,
              error: response.error.message || 'MCP エラー'
            });
          } else {
            resolve({
              success: true,
              data: response.result
            });
          }
        } catch {
          // JSON が完全でない場合は待機を続ける
        }
      };

      this.mcpProcess.stdout.on('data', onData);
      
      // リクエスト送信
      this.mcpProcess.stdin.write(JSON.stringify(request) + '\n');
      
      // タイムアウト処理
      setTimeout(() => {
        this.mcpProcess!.stdout!.off('data', onData);
        resolve({
          success: false,
          error: 'MCP リクエストタイムアウト'
        });
      }, 30000); // 30秒でタイムアウト
    });
  }

  /**
   * 初期化完了を待機
   */
  private async waitForInitialization(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.mcpProcess) {
        reject(new Error('MCP プロセスが存在しません'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('MCP 初期化タイムアウト'));
      }, 10000); // 10秒でタイムアウト

      // プロセスが正常に起動したら初期化完了とみなす
      // 実際のMCPサーバーでは初期化メッセージを待つ方が良い
      setTimeout(() => {
        clearTimeout(timeout);
        resolve();
      }, 2000); // 2秒待機
    });
  }

  /**
   * リソースをクリーンアップ
   */
  async cleanup(): Promise<void> {
    if (this.mcpProcess) {
      console.log('🧹 GitHub MCP サーバーをクリーンアップ中...');
      this.mcpProcess.kill();
      this.mcpProcess = null;
      this.isInitialized = false;
    }
  }

  /**
   * 接続状態を確認
   */
  get isConnected(): boolean {
    return this.isInitialized && this.mcpProcess !== null && !this.mcpProcess.killed;
  }
}