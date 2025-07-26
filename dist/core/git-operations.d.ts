import { GitOperationResult, GitConfig, ChangeAnalysis, ProjectContext, PRManagementResult } from '../types/index.js';
export declare class GitOperations {
    private git;
    private octokit;
    private config;
    private subAgentManager;
    private projectPath;
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
    createPullRequest(prManagement: PRManagementResult, branchName: string, targetBranch?: string): Promise<{
        number: number;
        url: string;
    }>;
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
}
//# sourceMappingURL=git-operations.d.ts.map