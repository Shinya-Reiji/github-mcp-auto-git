import { SubAgent, AgentResult, SafetyAnalysisResult, CommitMessageResult, PRManagementResult, ChangeAnalysis } from '../types/index.js';
export declare class SubAgentManager {
    private agentsPath;
    private loadedAgents;
    constructor(agentsPath?: string);
    loadAgent(agentName: string): Promise<SubAgent>;
    executeAgent<T>(agentName: string, userPrompt: string, context?: any): Promise<AgentResult>;
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
}
//# sourceMappingURL=subagent-manager.d.ts.map