// GitHub MCP 自動Git操作システム - 型定義

export interface GitOperationResult {
  success: boolean;
  message: string;
  details: {
    commit?: string;
    branch?: string;
    pr?: number;
    merged?: boolean;
    safety?: SafetyAnalysisResult;
    commitMessage?: CommitMessageResult;
    prManagement?: PRManagementResult;
  };
  warnings?: string[];
  executionTime?: number;
}

export interface SafetyAnalysisResult {
  safetyScore: number;
  level: 'SAFE' | 'WARNING' | 'DANGER';
  risks: SafetyRisk[];
  recommendations: string[];
  autoApprove: boolean;
  confidence: number;
}

export interface SafetyRisk {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

export interface CommitMessageResult {
  title: string;
  body: string;
  footer?: string;
  conventional: string;
  confidence: number;
}

export interface PRManagementResult {
  prTitle: string;
  prBody: string;
  autoMerge: boolean;
  mergeStrategy: 'squash' | 'merge' | 'rebase';
  reviewers: string[];
  labels: string[];
  assignees: string[];
  deleteBranch: boolean;
  reasoning: string;
}

export interface ChangeAnalysis {
  type: 'feature' | 'bugfix' | 'refactor' | 'docs' | 'test' | 'style';
  impact: 'low' | 'medium' | 'high';
  files: string[];
  description: string;
  metrics?: {
    linesAdded: number;
    linesDeleted: number;
    complexity: number;
  };
}

export interface SubAgent {
  name: string;
  description: string;
  version: string;
  tools?: string[];
  prompt: string;
}

export interface AgentResult {
  agentName: string;
  result: any;
  executionTime: number;
  confidence: number;
  error?: string;
}

export interface GitConfig {
  enabled: boolean;
  triggers: string[];
  paths: string[];
  subAgents: {
    gitSafetyAnalyzer: {
      enabled: boolean;
      safetyThreshold: number;
    };
    commitMessageGenerator: {
      enabled: boolean;
      language: string;
      style: string;
    };
    prManagementAgent: {
      enabled: boolean;
      autoMergeThreshold: number;
    };
  };
  notifications: {
    success: boolean;
    warnings: boolean;
    detailed: boolean;
  };
  github: {
    owner: string;
    repo: string;
    token: string;
  };
}

export interface ProjectContext {
  name: string;
  type: string;
  language: string;
  framework?: string;
  dependencies: string[];
  gitHistory: {
    recentCommits: string[];
    branches: string[];
    contributors: string[];
  };
}