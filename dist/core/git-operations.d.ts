import { GitOperationResult, GitConfig, ChangeAnalysis, ProjectContext, PRManagementResult } from '../types/index.js';
export declare class GitOperations {
    private git;
    private octokit;
    private config;
    private subAgentManager;
    private projectPath;
    private errorRecovery;
    private resilientExecutor;
    private securityManager;
    private mcpManager;
    private constitutionalChecker;
    constructor(config: GitConfig, projectPath?: string);
    initialize(): Promise<void>;
    analyzeChanges(files?: string[]): Promise<ChangeAnalysis>;
    executeGitWorkflow(files?: string[], options?: {
        branchName?: string;
        targetBranch?: string;
        autoCommit?: boolean;
        autoPush?: boolean;
        createPR?: boolean;
    }): Promise<GitOperationResult>;
    private _executeGitWorkflowInternal;
    createPullRequest(prManagement: PRManagementResult, branchName: string, targetBranch?: string): Promise<{
        number: number;
        url: string;
    }>;
    /**
     * PR設定（ラベル、レビュアー、自動マージ）の適用
     */
    private configurePullRequestSettings;
    /**
     * MCP対応の自動マージ試行
     */
    attemptAutoMergeMCP(prNumber: number, mergeStrategy?: 'squash' | 'merge' | 'rebase'): Promise<boolean>;
    attemptAutoMerge(prNumber: number, mergeStrategy?: 'squash' | 'merge' | 'rebase'): Promise<boolean>;
    getProjectContext(): Promise<ProjectContext>;
    private getCurrentBranch;
    private determineChangeType;
    private calculateImpact;
    private calculateComplexity;
    private generateChangeDescription;
    private detectProjectType;
    private detectLanguage;
    private detectFramework;
    private buildSuccessMessage;
    /**
     * Cleanup all resources including MCP connections
     * Fail Fast: Comprehensive cleanup with error handling
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=git-operations.d.ts.map