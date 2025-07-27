import { SubAgent, AgentResult, SafetyAnalysisResult, CommitMessageResult, PRManagementResult, ChangeAnalysis } from '../types/index.js';
export declare class SubAgentManager {
    private agentsPath;
    private loadedAgents;
    private independentAgents;
    private workingDir;
    private memoryExecutor;
    constructor(agentsPath?: string, workingDir?: string);
    loadAgent(agentName: string): Promise<SubAgent>;
    executeAgent<T>(agentName: string, userPrompt: string, context?: any): Promise<AgentResult>;
    /**
     * Execute multiple agents in parallel with memory optimization
     * Fail Fast: Resource validation and task prioritization
     * Be Lazy: Memory-aware batch execution
     * TypeScript First: Complete type safety for parallel execution
     */
    executeParallel<T>(agentExecutions: Array<{
        agentName: string;
        userPrompt: string;
        context?: any;
    }>): Promise<AgentResult[]>;
    analyzeSafety(context: {
        files: string[];
        diff: string;
        changes: ChangeAnalysis;
    }): Promise<SafetyAnalysisResult>;
    generateCommitMessage(context: {
        changes: ChangeAnalysis;
        diff: string;
        files: string[];
    }): Promise<CommitMessageResult>;
    managePR(context: {
        changes: ChangeAnalysis;
        safety: SafetyAnalysisResult;
        commitMessage: CommitMessageResult;
        branchName: string;
        targetBranch: string;
    }): Promise<PRManagementResult>;
    executeGitWorkflow(context: {
        files: string[];
        diff: string;
        changes: ChangeAnalysis;
        branchName: string;
        targetBranch?: string;
    }): Promise<{
        safety: SafetyAnalysisResult;
        commitMessage: CommitMessageResult;
        prManagement: PRManagementResult;
        executionTime: number;
        errors: string[];
    }>;
    private extractConfidence;
    private generateFallbackResult;
    private createFallbackSafety;
    private createFallbackCommitMessage;
    private createFallbackPRManagement;
    getAgentStatus(): Promise<{
        loaded: string[];
        available: string[];
        errors: string[];
    }>;
    /**
     * Add cleanup method for memory executor
     * Fail Fast: Comprehensive cleanup with error handling
     */
    cleanup(): Promise<void>;
    /**
     * Get memory statistics from executor
     * Be Lazy: Efficient memory monitoring
     */
    getMemoryStats(): import("./memory-efficient-executor.js").MemoryStats;
    /**
     * Determine agent priority based on agent type
     * Critical: git-safety-analyzer (security critical)
     * High: commit-message-generator (user-facing)
     * Medium: pr-management-agent (automation)
     */
    private getAgentPriority;
    /**
     * Estimate timeout for agent based on complexity
     * Safety analysis: 45s (complex file analysis)
     * Commit message: 30s (text generation)
     * PR management: 20s (decision making)
     */
    private getAgentTimeout;
    /**
     * Estimate memory usage for agent based on typical operations
     * Safety analysis: 64MB (file reading + analysis)
     * Commit message: 32MB (text processing)
     * PR management: 24MB (decision logic)
     */
    private getAgentMemoryEstimate;
}
//# sourceMappingURL=subagent-manager.d.ts.map