import simpleGit, { SimpleGit, StatusResult, DiffResult } from 'simple-git';
import { Octokit } from '@octokit/rest';
import { promises as fs } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { 
  GitOperationResult, 
  GitConfig, 
  ChangeAnalysis, 
  ProjectContext,
  SafetyAnalysisResult,
  CommitMessageResult,
  PRManagementResult
} from '../types/index.js';
import { SubAgentManager } from './subagent-manager.js';
import { ErrorRecoverySystem, ErrorCategory, ErrorLevel } from './error-recovery.js';
import { ResilientExecutor, ExecutionOptions } from './resilient-executor.js';
import { SecurityManager, SecurityLevel, ValidationResult } from './security-manager.js';
import { UnifiedMCPManager } from './unified-mcp-manager.js';
import { ConstitutionalAIChecker } from './constitutional-ai-checker.js';

// パッケージ内のエージェントディレクトリを取得
function getAgentsDirectory(): string {
  try {
    // __filename の代替として import.meta.url を使用
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    
    // パッケージルートから agents ディレクトリを探す
    const packageRoot = join(__dirname, '..', '..');
    const agentsPath = join(packageRoot, 'src', 'agents');
    
    return agentsPath;
  } catch (error) {
    // フォールバック: 従来の相対パス
    console.warn('⚠️ Could not determine package agents directory, using fallback');
    return './src/agents';
  }
}

export class GitOperations {
  private git: SimpleGit;
  private octokit: Octokit;
  private config: GitConfig;
  private subAgentManager: SubAgentManager;
  private projectPath: string;
  private errorRecovery: ErrorRecoverySystem;
  private resilientExecutor: ResilientExecutor;
  private securityManager: SecurityManager;
  private mcpManager: UnifiedMCPManager;
  private constitutionalChecker: ConstitutionalAIChecker;

  constructor(config: GitConfig, projectPath: string = process.cwd()) {
    this.config = config;
    this.projectPath = projectPath;
    this.git = simpleGit(projectPath);
    this.octokit = new Octokit({ auth: config.github.token });
    this.subAgentManager = new SubAgentManager(
      getAgentsDirectory(),
      projectPath
    );
    this.errorRecovery = new ErrorRecoverySystem();
    this.resilientExecutor = new ResilientExecutor();
    this.securityManager = new SecurityManager();
    this.mcpManager = new UnifiedMCPManager(config);
    this.constitutionalChecker = new ConstitutionalAIChecker(this.projectPath);
  }

  async initialize(): Promise<void> {
    try {
      // セキュリティ検証: 設定の妥当性チェック
      const configValidation = this.securityManager.validateInput(
        this.config, 
        'object', 
        SecurityLevel.INTERNAL
      );
      
      if (!configValidation.isValid) {
        const criticalThreats = configValidation.threats.filter(t => t.severity === 'critical');
        if (criticalThreats.length > 0) {
          throw new Error(`設定にセキュリティ問題があります: ${criticalThreats.map(t => t.description).join(', ')}`);
        }
      }

      // GitHub トークンの検証
      if (this.config.github.token) {
        const tokenValidation = await this.securityManager.validateToken(
          this.config.github.token, 
          'github'
        );
        
        if (!tokenValidation.isValid) {
          console.warn('⚠️ GitHub トークンの検証に失敗しました');
        } else {
          console.log(`✅ GitHub トークン検証成功 (権限: ${tokenValidation.permissions.join(', ')})`);
        }
      }

      await this.git.init();
      const status = await this.subAgentManager.getAgentStatus();
      
      if (status.errors.length > 0) {
        console.warn('⚠️ Some sub-agents failed to load:', status.errors);
      }
      
      console.log(`✅ Git operations initialized with ${status.available.length} sub-agents`);
      
      // Unified MCP Manager の初期化
      try {
        await this.mcpManager.initialize();
        console.log(`✅ Unified MCP Manager 初期化完了`);
      } catch (error) {
        console.warn('⚠️ MCP Manager 初期化に失敗（フォールバックモードで継続）:', error);
      }
    } catch (error) {
      return await this.errorRecovery.handleError(
        error as Error,
        {
          operation: 'initialize',
          timestamp: new Date(),
          workingDir: this.projectPath,
          attempt: 1
        },
        async () => {
          // 軽量な初期化のフォールバック
          console.log('🔧 フォールバック初期化を実行中...');
          return;
        }
      );
    }
  }

  async analyzeChanges(files?: string[]): Promise<ChangeAnalysis> {
    try {
      const status = await this.git.status();
      const diff = await this.git.diff(['--cached']);
      
      const changedFiles = files || [
        ...status.modified,
        ...status.created,
        ...status.deleted,
        ...status.renamed.map(r => r.to)
      ];

      const linesAdded = (diff.match(/^\+/gm) || []).length;
      const linesDeleted = (diff.match(/^-/gm) || []).length;
      
      const changeType = this.determineChangeType(changedFiles, diff);
      const impact = this.calculateImpact(changedFiles.length, linesAdded + linesDeleted);

      return {
        type: changeType,
        impact,
        files: changedFiles,
        description: this.generateChangeDescription(changedFiles, changeType),
        metrics: {
          linesAdded,
          linesDeleted,
          complexity: this.calculateComplexity(diff, changedFiles)
        }
      };
    } catch (error) {
      throw new Error(`Failed to analyze changes: ${error}`);
    }
  }

  async executeGitWorkflow(
    files?: string[], 
    options: {
      branchName?: string;
      targetBranch?: string;
      autoCommit?: boolean;
      autoPush?: boolean;
      createPR?: boolean;
    } = {}
  ): Promise<GitOperationResult> {
    const result = await this.resilientExecutor.execute(
      async () => this._executeGitWorkflowInternal(files, options),
      {
        name: 'git-workflow',
        workingDir: this.projectPath,
        files,
        metadata: { options }
      },
      {
        maxRetries: 2,
        timeoutMs: 60000,
        critical: true,
        fallbackRequired: true,
        description: 'Complete Git workflow execution',
        claudeCodeOptimized: true,
        adaptiveTimeout: true,
        priorityLevel: 'high'
      }
    );

    if (!result.success) {
      return {
        success: false,
        message: `Git操作が失敗しました: ${result.error?.message}`,
        details: {},
        warnings: result.warnings,
        executionTime: result.executionTime
      };
    }

    return result.data as GitOperationResult;
  }

  private async _executeGitWorkflowInternal(
    files?: string[], 
    options: {
      branchName?: string;
      targetBranch?: string;
      autoCommit?: boolean;
      autoPush?: boolean;
      createPR?: boolean;
    } = {}
  ): Promise<GitOperationResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // セキュリティ検証: ファイルパスの検証
      if (files && files.length > 0) {
        for (const file of files) {
          const fileValidation = this.securityManager.validateInput(
            file, 
            'string', 
            SecurityLevel.RESTRICTED
          );
          
          if (!fileValidation.isValid) {
            const criticalThreats = fileValidation.threats.filter(t => t.severity === 'critical');
            if (criticalThreats.length > 0) {
              throw new Error(`ファイルパスにセキュリティ問題があります: ${file} - ${criticalThreats.map(t => t.description).join(', ')}`);
            }
            warnings.push(`ファイルパス警告: ${file} - ${fileValidation.threats.map(t => t.description).join(', ')}`);
          }
        }
      }

      // オプションの検証
      const optionsValidation = this.securityManager.validateInput(
        options, 
        'object', 
        SecurityLevel.PUBLIC
      );
      
      if (!optionsValidation.isValid) {
        const criticalThreats = optionsValidation.threats.filter(t => t.severity === 'critical');
        if (criticalThreats.length > 0) {
          throw new Error(`オプションにセキュリティ問題があります: ${criticalThreats.map(t => t.description).join(', ')}`);
        }
      }

      const status = await this.git.status();
      
      if (status.isClean() && !files) {
        return {
          success: false,
          message: '変更がありません。コミットする内容がありません。',
          details: {},
          warnings: ['変更がないため、Git操作をスキップしました'],
          executionTime: Date.now() - startTime
        };
      }

      if (files && files.length > 0) {
        await this.git.add(files);
      } else {
        await this.git.add('.');
      }

      const changes = await this.analyzeChanges(files);
      const diff = await this.git.diff(['--cached']);

      const workflowResult = await this.subAgentManager.executeGitWorkflow({
        files: changes.files,
        diff,
        changes,
        branchName: options.branchName || await this.getCurrentBranch(),
        targetBranch: options.targetBranch
      });

      if (workflowResult.errors.length > 0) {
        warnings.push(...workflowResult.errors);
      }

      if (workflowResult.safety.level === 'DANGER') {
        return {
          success: false,
          message: '❌ 安全性チェックで重大な問題が検出されました。Git操作を停止します。',
          details: { safety: workflowResult.safety },
          warnings: workflowResult.safety.recommendations,
          executionTime: Date.now() - startTime
        };
      }

      if (workflowResult.safety.level === 'WARNING' && workflowResult.safety.safetyScore < 70) {
        warnings.push('⚠️ 安全性に関する警告があります。慎重に進めてください。');
      }

      let commitHash: string = '';
      if (options.autoCommit !== false) {
        const commitResult = await this.git.commit(workflowResult.commitMessage.title);
        commitHash = commitResult.commit;
      }

      let branchName = options.branchName;
      if (!branchName) {
        branchName = await this.getCurrentBranch();
      }

      if (options.autoPush !== false && commitHash) {
        await this.git.push('origin', branchName);
      }

      let prNumber: number | undefined;
      if (options.createPR && workflowResult.prManagement && commitHash) {
        try {
          const pr = await this.createPullRequest(
            workflowResult.prManagement,
            branchName,
            options.targetBranch || 'main'
          );
          prNumber = pr.number;
        } catch (error) {
          warnings.push(`PR作成に失敗しました: ${error}`);
        }
      }

      return {
        success: true,
        message: this.buildSuccessMessage(workflowResult, commitHash, prNumber),
        details: {
          commit: commitHash,
          branch: branchName,
          pr: prNumber,
          safety: workflowResult.safety,
          commitMessage: workflowResult.commitMessage,
          prManagement: workflowResult.prManagement
        },
        warnings,
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        message: `Git操作が失敗しました: ${error}`,
        details: {},
        warnings,
        executionTime: Date.now() - startTime
      };
    }
  }

  async createPullRequest(
    prManagement: PRManagementResult,
    branchName: string,
    targetBranch: string = 'main'
  ): Promise<{ number: number; url: string }> {
    try {
      // Unified MCP Manager を優先使用
      if (this.mcpManager.isServerAvailable('github')) {
        console.log('🔗 Unified MCP経由でPR作成中...');
        
        const mcpResult = await this.mcpManager.createPullRequest({
          title: prManagement.prTitle,
          body: prManagement.prBody,
          head: branchName,
          base: targetBranch,
          draft: false,
          maintainer_can_modify: true
        });

        if (mcpResult.success && mcpResult.data) {
          const prNumber = mcpResult.data.number;
          
          // ラベルとレビュアーの設定はOctokitでフォローアップ
          await this.configurePullRequestSettings(prNumber, prManagement);
          
          return {
            number: prNumber,
            url: mcpResult.data.url
          };
        } else {
          console.warn('⚠️ MCP PR作成失敗、Octokitでフォールバック:', mcpResult.error);
        }
      }
      
      // フォールバック: 従来のOctokit方式
      console.log('🔗 Octokit経由でPR作成中...');
      const response = await this.octokit.rest.pulls.create({
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        title: prManagement.prTitle,
        body: prManagement.prBody,
        head: branchName,
        base: targetBranch
      });

      const prNumber = response.data.number;
      
      // PR設定の適用
      await this.configurePullRequestSettings(prNumber, prManagement);

      return {
        number: prNumber,
        url: response.data.html_url
      };

    } catch (error) {
      throw new Error(`Failed to create pull request: ${error}`);
    }
  }

  /**
   * PR設定（ラベル、レビュアー、自動マージ）の適用
   */
  private async configurePullRequestSettings(
    prNumber: number, 
    prManagement: PRManagementResult
  ): Promise<void> {
    try {
      // ラベルの追加
      if (prManagement.labels.length > 0) {
        await this.octokit.rest.issues.addLabels({
          owner: this.config.github.owner,
          repo: this.config.github.repo,
          issue_number: prNumber,
          labels: prManagement.labels
        });
      }

      // レビュアーの追加
      if (prManagement.reviewers.length > 0) {
        await this.octokit.rest.pulls.requestReviewers({
          owner: this.config.github.owner,
          repo: this.config.github.repo,
          pull_number: prNumber,
          reviewers: prManagement.reviewers
        });
      }

      // アサインの追加
      if (prManagement.assignees.length > 0) {
        await this.octokit.rest.issues.addAssignees({
          owner: this.config.github.owner,
          repo: this.config.github.repo,
          issue_number: prNumber,
          assignees: prManagement.assignees
        });
      }

      // 自動マージのスケジュール
      if (prManagement.autoMerge) {
        setTimeout(async () => {
          try {
            await this.attemptAutoMergeMCP(prNumber, prManagement.mergeStrategy);
          } catch (error) {
            console.warn(`自動マージに失敗しました: ${error}`);
          }
        }, 30000); // 30秒後に自動マージを試行
      }
    } catch (error) {
      console.warn('⚠️ PR設定の一部に失敗しました:', error);
    }
  }

  /**
   * MCP対応の自動マージ試行
   */
  async attemptAutoMergeMCP(
    prNumber: number,
    mergeStrategy: 'squash' | 'merge' | 'rebase' = 'squash'
  ): Promise<boolean> {
    try {
      console.log(`🔀 PR #${prNumber} の自動マージを試行中...`);
      
      // Unified MCP Manager を優先使用
      if (this.mcpManager.isServerAvailable('github')) {
        console.log('🔗 MCP経由でPR状態確認中...');
        
        const statusResult = await this.mcpManager.getPullRequestStatus(prNumber);
        if (!statusResult.success) {
          console.warn('⚠️ MCP PR状態確認失敗、Octokitでフォールバック');
          return await this.attemptAutoMerge(prNumber, mergeStrategy);
        }

        const prStatus = statusResult.data;
        if (!prStatus.mergeable || prStatus.mergeable_state !== 'clean') {
          console.log(`⏸️ PR #${prNumber} はマージ可能状態ではありません`);
          return false;
        }

        // MCP経由でマージ実行
        console.log('🔗 MCP経由でPRマージ実行中...');
        const mergeResult = await this.mcpManager.mergePullRequest({
          pullNumber: prNumber,
          mergeMethod: mergeStrategy,
          commitTitle: `Merge PR #${prNumber}`,
          commitMessage: `Auto-merge via GitHub MCP`
        });

        if (mergeResult.success) {
          console.log(`✅ PR #${prNumber} のマージ成功（MCP経由）`);
          
          // ブランチ削除を試行
          try {
            await this.mcpManager.deleteBranch(`pr-${prNumber}`);
          } catch (error) {
            console.warn('⚠️ ブランチ削除に失敗:', error);
          }
          
          return true;
        } else {
          console.warn('⚠️ MCP マージ失敗、Octokitでフォールバック:', mergeResult.error);
        }
      }
      
      // フォールバック: 従来のOctokit方式
      return await this.attemptAutoMerge(prNumber, mergeStrategy);
      
    } catch (error) {
      console.error(`❌ 自動マージ試行エラー: ${error}`);
      return false;
    }
  }

  async attemptAutoMerge(
    prNumber: number,
    mergeStrategy: 'squash' | 'merge' | 'rebase' = 'squash'
  ): Promise<boolean> {
    try {
      const pr = await this.octokit.rest.pulls.get({
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        pull_number: prNumber
      });

      if (!pr.data.mergeable || pr.data.mergeable_state !== 'clean') {
        return false;
      }

      const checks = await this.octokit.rest.checks.listForRef({
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        ref: pr.data.head.sha
      });

      const allChecksPassed = checks.data.check_runs.every(
        check => check.status === 'completed' && check.conclusion === 'success'
      );

      if (!allChecksPassed) {
        return false;
      }

      await this.octokit.rest.pulls.merge({
        owner: this.config.github.owner,
        repo: this.config.github.repo,
        pull_number: prNumber,
        merge_method: mergeStrategy
      });

      if (this.config.github.token && pr.data.head.ref !== 'main') {
        try {
          await this.octokit.rest.git.deleteRef({
            owner: this.config.github.owner,
            repo: this.config.github.repo,
            ref: `heads/${pr.data.head.ref}`
          });
        } catch (error) {
          console.warn(`ブランチ削除に失敗しました: ${error}`);
        }
      }

      return true;

    } catch (error) {
      console.error(`Auto-merge failed: ${error}`);
      return false;
    }
  }

  async getProjectContext(): Promise<ProjectContext> {
    try {
      const packageJsonPath = join(this.projectPath, 'package.json');
      let packageJson: any = {};
      
      try {
        const content = await fs.readFile(packageJsonPath, 'utf-8');
        packageJson = JSON.parse(content);
      } catch {
        // package.json が存在しない場合
      }

      const log = await this.git.log({ maxCount: 10 });
      const branches = await this.git.branch();

      return {
        name: packageJson.name || basename(this.projectPath),
        type: this.detectProjectType(packageJson),
        language: this.detectLanguage(packageJson),
        framework: this.detectFramework(packageJson),
        dependencies: Object.keys(packageJson.dependencies || {}),
        gitHistory: {
          recentCommits: log.all.map(commit => commit.message),
          branches: branches.all,
          contributors: [...new Set(log.all.map(commit => commit.author_name))]
        }
      };
    } catch (error) {
      throw new Error(`Failed to get project context: ${error}`);
    }
  }

  private async getCurrentBranch(): Promise<string> {
    const status = await this.git.status();
    return status.current || 'main';
  }

  private determineChangeType(files: string[], diff: string): ChangeAnalysis['type'] {
    const testFiles = files.filter(f => f.includes('test') || f.includes('spec'));
    const docFiles = files.filter(f => f.endsWith('.md') || f.includes('doc'));
    const styleFiles = files.filter(f => f.endsWith('.css') || f.endsWith('.scss') || f.endsWith('.less'));

    if (testFiles.length > files.length * 0.7) return 'test';
    if (docFiles.length > files.length * 0.7) return 'docs';
    if (styleFiles.length > files.length * 0.7) return 'style';
    
    if (diff.includes('fix') || diff.includes('bug') || diff.includes('error')) {
      return 'bugfix';
    }
    
    if (diff.includes('refactor') || diff.includes('clean') || diff.includes('optimize')) {
      return 'refactor';
    }

    return 'feature';
  }

  private calculateImpact(fileCount: number, lineCount: number): 'low' | 'medium' | 'high' {
    if (fileCount <= 3 && lineCount <= 50) return 'low';
    if (fileCount <= 10 && lineCount <= 200) return 'medium';
    return 'high';
  }

  private calculateComplexity(diff: string, files: string[]): number {
    let complexity = 0;
    
    complexity += files.length * 2;
    complexity += (diff.match(/^\+/gm) || []).length * 0.5;
    complexity += (diff.match(/^-/gm) || []).length * 0.3;
    
    const patterns = [
      /function\s+\w+/g,
      /class\s+\w+/g,
      /interface\s+\w+/g,
      /if\s*\(/g,
      /for\s*\(/g,
      /while\s*\(/g
    ];
    
    patterns.forEach(pattern => {
      const matches = diff.match(pattern) || [];
      complexity += matches.length * 3;
    });

    return Math.min(complexity, 100);
  }

  private generateChangeDescription(files: string[], type: ChangeAnalysis['type']): string {
    const fileCount = files.length;
    const typeDesc = {
      feature: '新機能追加',
      bugfix: 'バグ修正',
      refactor: 'リファクタリング',
      docs: 'ドキュメント更新',
      test: 'テスト追加・修正',
      style: 'スタイル調整'
    };

    return `${typeDesc[type]} (${fileCount}ファイル変更)`;
  }

  private detectProjectType(packageJson: any): string {
    if (packageJson.scripts?.dev?.includes('next')) return 'Next.js';
    if (packageJson.dependencies?.react) return 'React';
    if (packageJson.dependencies?.vue) return 'Vue.js';
    if (packageJson.dependencies?.express) return 'Express';
    if (packageJson.type === 'module') return 'ES Module';
    return 'Node.js';
  }

  private detectLanguage(packageJson: any): string {
    if (packageJson.dependencies?.typescript || packageJson.devDependencies?.typescript) {
      return 'TypeScript';
    }
    return 'JavaScript';
  }

  private detectFramework(packageJson: any): string | undefined {
    const frameworks = {
      'next': 'Next.js',
      'react': 'React',
      'vue': 'Vue.js',
      'express': 'Express',
      'fastify': 'Fastify',
      'nest': 'NestJS'
    };

    for (const [dep, framework] of Object.entries(frameworks)) {
      if (packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]) {
        return framework;
      }
    }

    return undefined;
  }

  private buildSuccessMessage(
    result: {
      safety: SafetyAnalysisResult;
      commitMessage: CommitMessageResult;
      prManagement?: PRManagementResult;
    },
    commitHash: string,
    prNumber?: number
  ): string {
    let message = `✅ Git操作が完了しました\n\n`;
    message += `📝 コミット: ${result.commitMessage.title}\n`;
    message += `🔒 安全性: ${result.safety.level} (スコア: ${result.safety.safetyScore})\n`;
    message += `🆔 ハッシュ: ${commitHash.substring(0, 8)}\n`;
    
    if (prNumber) {
      message += `🔀 PR: #${prNumber}\n`;
      if (result.prManagement?.autoMerge) {
        message += `⚡ 自動マージ予定\n`;
      }
    }

    return message;
  }

  /**
   * Cleanup all resources including MCP connections
   * Fail Fast: Comprehensive cleanup with error handling
   */
  async cleanup(): Promise<void> {
    try {
      console.log('🧹 GitOperations リソースクリーンアップ中...');
      
      // Cleanup MCP Manager
      await this.mcpManager.cleanup();
      
      console.log('✅ GitOperations クリーンアップ完了');
    } catch (error) {
      console.error('❌ GitOperations クリーンアップエラー:', error);
      throw error;
    }
  }
}