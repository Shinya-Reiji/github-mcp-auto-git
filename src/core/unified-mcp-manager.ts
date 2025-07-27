/**
 * Unified MCP Manager - Centralized MCP Client Management
 * Consolidates all MCP operations following Constitutional AI principles
 */

import { spawn, ChildProcess } from 'child_process';
import { GitConfig } from '../types/index.js';

export interface MCPServer {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  enabled: boolean;
}

export interface MCPRequest {
  method: string;
  params: {
    name: string;
    arguments: Record<string, any>;
  };
}

export interface MCPResponse {
  success: boolean;
  data?: any;
  error?: string;
  warnings?: string[];
}

export interface MCPOperation {
  server: string;
  operation: string;
  params: Record<string, any>;
  timeout?: number;
}

export class UnifiedMCPManager {
  private servers = new Map<string, ChildProcess>();
  private serverConfigs = new Map<string, MCPServer>();
  private initialized = new Set<string>();
  private config: GitConfig;
  
  constructor(config: GitConfig) {
    this.config = config;
    this.setupServerConfigurations();
  }

  /**
   * Initialize all configured MCP servers
   * Fail Fast: Comprehensive validation and early error detection
   * Be Lazy: Initialize only enabled servers
   * TypeScript First: Complete type safety for server management
   */
  async initialize(): Promise<void> {
    console.log('🔗 Unified MCP Manager を初期化中...');
    
    const enabledServers = Array.from(this.serverConfigs.values())
      .filter(server => server.enabled);
    
    if (enabledServers.length === 0) {
      console.log('ℹ️ 有効なMCPサーバーがありません');
      return;
    }

    // Initialize servers in parallel for efficiency (Be Lazy)
    const initPromises = enabledServers.map(server => 
      this.initializeServer(server).catch(error => {
        console.warn(`⚠️ ${server.name} 初期化失敗:`, error.message);
        return null;
      })
    );

    const results = await Promise.allSettled(initPromises);
    const successCount = results.filter(result => 
      result.status === 'fulfilled' && result.value !== null
    ).length;

    console.log(`✅ MCP Manager 初期化完了: ${successCount}/${enabledServers.length} サーバー`);
  }

  /**
   * Execute MCP operation with automatic fallback
   * Fail Fast: Immediate server validation and error handling
   * Be Lazy: Smart server selection and operation optimization
   */
  async executeOperation(operation: MCPOperation): Promise<MCPResponse> {
    const { server: serverName, operation: operationName, params, timeout = 30000 } = operation;
    
    // Validate server exists and is initialized
    if (!this.isServerAvailable(serverName)) {
      return {
        success: false,
        error: `MCP server '${serverName}' is not available`
      };
    }

    try {
      console.log(`🔄 MCP操作実行: ${serverName}.${operationName}`);
      
      const request: MCPRequest = {
        method: 'tools/call',
        params: {
          name: operationName,
          arguments: params
        }
      };

      const response = await this.sendRequest(serverName, request, timeout);
      
      if (response.success) {
        console.log(`✅ MCP操作成功: ${serverName}.${operationName}`);
      } else {
        console.warn(`⚠️ MCP操作失敗: ${serverName}.${operationName} - ${response.error}`);
      }
      
      return response;
      
    } catch (error) {
      console.error(`❌ MCP操作エラー: ${serverName}.${operationName}`, error);
      return {
        success: false,
        error: `MCP operation failed: ${error}`
      };
    }
  }

  /**
   * GitHub-specific operations with unified interface
   * TypeScript First: Strongly typed GitHub operations
   */
  async createPullRequest(options: {
    title: string;
    body: string;
    head: string;
    base: string;
    draft?: boolean;
    maintainer_can_modify?: boolean;
  }): Promise<MCPResponse> {
    return this.executeOperation({
      server: 'github',
      operation: 'create_pull_request',
      params: {
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        ...options
      }
    });
  }

  async mergePullRequest(options: {
    pullNumber: number;
    mergeMethod?: 'merge' | 'squash' | 'rebase';
    commitTitle?: string;
    commitMessage?: string;
  }): Promise<MCPResponse> {
    return this.executeOperation({
      server: 'github',
      operation: 'merge_pull_request',
      params: {
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        pull_number: options.pullNumber,
        merge_method: options.mergeMethod || 'squash',
        commit_title: options.commitTitle,
        commit_message: options.commitMessage
      }
    });
  }

  async getPullRequestStatus(pullNumber: number): Promise<MCPResponse> {
    return this.executeOperation({
      server: 'github',
      operation: 'get_pull_request',
      params: {
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        pull_number: pullNumber
      }
    });
  }

  async deleteBranch(branchName: string): Promise<MCPResponse> {
    return this.executeOperation({
      server: 'github',
      operation: 'delete_branch',
      params: {
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        ref: `heads/${branchName}`
      }
    });
  }

  /**
   * Check if a specific server is available
   * Be Lazy: Efficient server availability checking
   */
  isServerAvailable(serverName: string): boolean {
    return this.initialized.has(serverName) && 
           this.servers.has(serverName) && 
           !this.servers.get(serverName)?.killed;
  }

  /**
   * Get status of all MCP servers
   * TypeScript First: Type-safe status reporting
   */
  getServerStatus(): {
    server: string;
    status: 'active' | 'inactive' | 'error';
    enabled: boolean;
  }[] {
    return Array.from(this.serverConfigs.entries()).map(([name, config]) => ({
      server: name,
      status: this.isServerAvailable(name) ? 'active' : 
              this.servers.has(name) ? 'error' : 'inactive',
      enabled: config.enabled
    }));
  }

  /**
   * Cleanup all MCP servers
   * Fail Fast: Comprehensive cleanup with error handling
   */
  async cleanup(): Promise<void> {
    console.log('🧹 MCP Manager クリーンアップ中...');
    
    const cleanupPromises = Array.from(this.servers.entries()).map(
      async ([name, process]) => {
        try {
          console.log(`🛑 ${name} サーバー停止中...`);
          process.kill();
          await this.waitForProcessExit(process, 5000);
          console.log(`✅ ${name} サーバー停止完了`);
        } catch (error) {
          console.warn(`⚠️ ${name} サーバー停止失敗:`, error);
        }
      }
    );

    await Promise.allSettled(cleanupPromises);
    
    this.servers.clear();
    this.initialized.clear();
    
    console.log('✅ MCP Manager クリーンアップ完了');
  }

  /**
   * Setup server configurations
   * Be Lazy: Configuration-driven server setup
   */
  private setupServerConfigurations(): void {
    // GitHub MCP Server
    this.serverConfigs.set('github', {
      name: 'GitHub MCP',
      command: 'mcp-server-github',
      args: [],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: this.config.github.token || '',
        GITHUB_OWNER: this.config.github.owner || '',
        GITHUB_REPO: this.config.github.repo || ''
      },
      enabled: Boolean(this.config.github.token)
    });

    // Future: Add more MCP servers here
    // this.serverConfigs.set('slack', { ... });
    // this.serverConfigs.set('notion', { ... });
  }

  /**
   * Initialize a specific MCP server
   * Fail Fast: Immediate server validation and error handling
   */
  private async initializeServer(serverConfig: MCPServer): Promise<void> {
    try {
      console.log(`🚀 ${serverConfig.name} 初期化中...`);
      
      const mcpProcess = spawn(serverConfig.command, serverConfig.args, {
        env: { ...process.env, ...serverConfig.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (!mcpProcess.stdout || !mcpProcess.stderr || !mcpProcess.stdin) {
        throw new Error(`${serverConfig.name} プロセスの stdio が利用できません`);
      }

      // Setup error handling
      mcpProcess.on('error', (error: Error) => {
        console.error(`❌ ${serverConfig.name} プロセスエラー:`, error);
        this.handleServerError(serverConfig.name, error);
      });

      mcpProcess.stderr.on('data', (data: Buffer) => {
        console.warn(`⚠️ ${serverConfig.name} 警告:`, data.toString().trim());
      });

      mcpProcess.on('exit', (code: number | null, signal: string | null) => {
        console.warn(`⚠️ ${serverConfig.name} プロセス終了: code=${code}, signal=${signal}`);
        this.initialized.delete(serverConfig.name);
      });

      // Store the process
      this.servers.set(serverConfig.name, mcpProcess);
      
      // Wait for initialization
      await this.waitForServerInitialization(serverConfig.name, mcpProcess);
      
      this.initialized.add(serverConfig.name);
      console.log(`✅ ${serverConfig.name} 初期化完了`);
      
    } catch (error) {
      console.error(`❌ ${serverConfig.name} 初期化失敗:`, error);
      throw error;
    }
  }

  /**
   * Send request to MCP server
   * TypeScript First: Type-safe request/response handling
   */
  private async sendRequest(
    serverName: string, 
    request: MCPRequest, 
    timeout = 30000
  ): Promise<MCPResponse> {
    const process = this.servers.get(serverName);
    if (!process?.stdin || !process?.stdout) {
      return {
        success: false,
        error: `${serverName} server process not available`
      };
    }

    return new Promise((resolve) => {
      let responseData = '';
      let timeoutHandle: NodeJS.Timeout;
      
      const cleanup = () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        process.stdout?.off('data', onData);
      };
      
      const onData = (data: Buffer) => {
        responseData += data.toString();
        try {
          const response = JSON.parse(responseData);
          cleanup();
          
          if (response.error) {
            resolve({
              success: false,
              error: response.error.message || 'MCP server error'
            });
          } else {
            resolve({
              success: true,
              data: response.result
            });
          }
        } catch {
          // Incomplete JSON, continue waiting
        }
      };

      // Setup response handler
      process.stdout?.on('data', onData);
      
      // Setup timeout
      timeoutHandle = setTimeout(() => {
        cleanup();
        resolve({
          success: false,
          error: `Request timeout (${timeout}ms)`
        });
      }, timeout);
      
      // Send request
      const jsonRequest = {
        jsonrpc: '2.0',
        id: Date.now(),
        ...request
      };
      
      process.stdin?.write(JSON.stringify(jsonRequest) + '\n');
    });
  }

  /**
   * Wait for server initialization
   * Fail Fast: Timeout-based initialization validation
   */
  private async waitForServerInitialization(
    serverName: string, 
    process: ChildProcess, 
    timeout = 10000
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error(`${serverName} initialization timeout`));
      }, timeout);

      // For now, use simple timeout-based initialization
      // In a real implementation, wait for specific initialization message
      setTimeout(() => {
        clearTimeout(timeoutHandle);
        resolve();
      }, 2000);
    });
  }

  /**
   * Wait for process to exit
   * Be Lazy: Efficient process cleanup with timeout
   */
  private async waitForProcessExit(process: ChildProcess, timeout = 5000): Promise<void> {
    return new Promise((resolve) => {
      const timeoutHandle = setTimeout(() => {
        process.kill('SIGKILL'); // Force kill if timeout
        resolve();
      }, timeout);

      process.on('exit', () => {
        clearTimeout(timeoutHandle);
        resolve();
      });
    });
  }

  /**
   * Handle server errors with recovery attempts
   * Fail Fast: Immediate error detection and recovery
   */
  private handleServerError(serverName: string, error: Error): void {
    console.error(`❌ ${serverName} サーバーエラー:`, error);
    
    // Remove from initialized set
    this.initialized.delete(serverName);
    
    // Optionally attempt restart (could be configurable)
    setTimeout(async () => {
      const serverConfig = this.serverConfigs.get(serverName);
      if (serverConfig?.enabled) {
        console.log(`🔄 ${serverName} 自動復旧を試行中...`);
        try {
          await this.initializeServer(serverConfig);
          console.log(`✅ ${serverName} 自動復旧成功`);
        } catch (restartError) {
          console.error(`❌ ${serverName} 自動復旧失敗:`, restartError);
        }
      }
    }, 5000); // Wait 5 seconds before restart attempt
  }
}