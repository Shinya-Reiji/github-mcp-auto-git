import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { GitOperations } from '../../src/core/git-operations';
import type { GitConfig, ChangeAnalysis } from '../../src/types/index';

// モック設定
jest.mock('simple-git');
jest.mock('@octokit/rest');
jest.mock('../../src/core/subagent-manager');

import simpleGit from 'simple-git';
import { Octokit } from '@octokit/rest';
import { SubAgentManager } from '../../src/core/subagent-manager';

const mockSimpleGit = simpleGit as jest.MockedFunction<typeof simpleGit>;
const mockOctokit = Octokit as jest.MockedClass<typeof Octokit>;
const mockSubAgentManager = SubAgentManager as jest.MockedClass<typeof SubAgentManager>;

describe('GitOperations', () => {
  let gitOperations: GitOperations;
  let mockGit: any;
  let mockOctokitInstance: any;
  let mockSubAgentManagerInstance: any;
  
  const mockConfig: GitConfig = {
    enabled: true,
    triggers: ['save'],
    paths: ['src/**/*'],
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
      owner: 'test-owner',
      repo: 'test-repo',
      token: 'test-token'
    }
  };

  beforeEach(() => {
    // Git モック
    mockGit = {
      init: jest.fn().mockResolvedValue(undefined as any),
      status: jest.fn().mockResolvedValue({
        modified: ['file1.ts'],
        created: ['file2.ts'],
        deleted: [],
        renamed: [],
        isClean: () => false,
        current: 'main'
      } as any),
      diff: jest.fn().mockResolvedValue('+added line\n-removed line' as any),
      add: jest.fn().mockResolvedValue(undefined as any),
      commit: jest.fn().mockResolvedValue({ commit: 'abc123' } as any),
      push: jest.fn().mockResolvedValue(undefined as any),
      log: jest.fn().mockResolvedValue({
        all: [
          { message: 'Initial commit', author_name: 'Test User' }
        ]
      } as any),
      branch: jest.fn().mockResolvedValue({
        all: ['main', 'feature-branch'],
        current: 'main'
      } as any)
    };
    
    mockSimpleGit.mockReturnValue(mockGit);

    // Octokit モック
    mockOctokitInstance = {
      rest: {
        pulls: {
          create: jest.fn().mockResolvedValue({
            data: { number: 123, html_url: 'https://github.com/test/repo/pull/123' }
          } as any),
          merge: jest.fn().mockResolvedValue(undefined as any),
          get: jest.fn().mockResolvedValue({
            data: {
              mergeable: true,
              mergeable_state: 'clean',
              head: { sha: 'abc123', ref: 'feature-branch' }
            }
          } as any)
        },
        issues: {
          addLabels: jest.fn().mockResolvedValue(undefined as any),
          addAssignees: jest.fn().mockResolvedValue(undefined as any)
        },
        checks: {
          listForRef: jest.fn().mockResolvedValue({
            data: {
              check_runs: [
                { status: 'completed', conclusion: 'success' }
              ]
            }
          } as any)
        },
        git: {
          deleteRef: jest.fn().mockResolvedValue(undefined as any)
        }
      }
    };
    
    mockOctokit.mockImplementation(() => mockOctokitInstance);

    // SubAgentManager モック
    mockSubAgentManagerInstance = {
      getAgentStatus: jest.fn().mockResolvedValue({
        loaded: ['git-safety-analyzer'],
        available: ['git-safety-analyzer', 'commit-message-generator'],
        errors: []
      } as any),
      executeGitWorkflow: jest.fn().mockResolvedValue({
        safety: {
          safetyScore: 90,
          level: 'SAFE',
          risks: [],
          recommendations: [],
          autoApprove: true,
          confidence: 0.9
        },
        commitMessage: {
          title: 'feat: 新機能を追加',
          body: '新しい機能を追加しました',
          conventional: 'feat: add new feature',
          confidence: 0.8
        },
        prManagement: {
          prTitle: 'feat: 新機能を追加',
          prBody: '新しい機能を追加するPRです',
          autoMerge: false,
          mergeStrategy: 'squash',
          reviewers: [],
          labels: ['enhancement'],
          assignees: [],
          deleteBranch: true,
          reasoning: 'レビューが必要です'
        },
        executionTime: 1000,
        errors: []
      } as any)
    };
    
    mockSubAgentManager.mockImplementation(() => mockSubAgentManagerInstance);

    gitOperations = new GitOperations(mockConfig, '/test/path');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('initialize', () => {
    it('should initialize git and sub-agents successfully', async () => {
      await gitOperations.initialize();

      expect(mockGit.init).toHaveBeenCalled();
      expect(mockSubAgentManagerInstance.getAgentStatus).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      mockGit.init.mockRejectedValue(new Error('Git init failed'));

      await expect(gitOperations.initialize()).rejects.toThrow('Failed to initialize Git operations');
    });
  });

  describe('analyzeChanges', () => {
    it('should analyze changes correctly', async () => {
      const analysis = await gitOperations.analyzeChanges();

      expect(analysis).toEqual({
        type: 'feature',
        impact: 'low',
        files: ['file1.ts', 'file2.ts'],
        description: expect.stringContaining('新機能追加'),
        metrics: {
          linesAdded: 1,
          linesDeleted: 1,
          complexity: expect.any(Number)
        }
      });
    });

    it('should handle specific files parameter', async () => {
      const specificFiles = ['specific.ts'];
      const analysis = await gitOperations.analyzeChanges(specificFiles);

      expect(analysis.files).toEqual(specificFiles);
    });
  });

  describe('executeGitWorkflow', () => {
    it('should execute complete git workflow successfully', async () => {
      const result = await gitOperations.executeGitWorkflow();

      expect(result.success).toBe(true);
      expect(result.details.commit).toBe('abc123');
      expect(mockGit.add).toHaveBeenCalledWith('.');
      expect(mockGit.commit).toHaveBeenCalled();
    });

    it('should handle workflow with specific files', async () => {
      const files = ['test.ts'];
      const result = await gitOperations.executeGitWorkflow(files);

      expect(mockGit.add).toHaveBeenCalledWith(files);
      expect(result.success).toBe(true);
    });

    it('should stop execution on DANGER safety level', async () => {
      mockSubAgentManagerInstance.executeGitWorkflow.mockResolvedValue({
        safety: {
          safetyScore: 30,
          level: 'DANGER',
          risks: [{ type: 'secret_detected', severity: 'critical', description: 'API key found' }],
          recommendations: ['Remove API key'],
          autoApprove: false,
          confidence: 0.9
        },
        commitMessage: null,
        prManagement: null,
        executionTime: 500,
        errors: []
      });

      const result = await gitOperations.executeGitWorkflow();

      expect(result.success).toBe(false);
      expect(result.message).toContain('安全性チェックで重大な問題が検出されました');
      expect(mockGit.commit).not.toHaveBeenCalled();
    });

    it('should handle clean repository', async () => {
      mockGit.status.mockResolvedValue({
        modified: [],
        created: [],
        deleted: [],
        renamed: [],
        isClean: () => true,
        current: 'main'
      });

      const result = await gitOperations.executeGitWorkflow();

      expect(result.success).toBe(false);
      expect(result.message).toContain('変更がありません');
    });
  });

  describe('createPullRequest', () => {
    const mockPRManagement = {
      prTitle: 'Test PR',
      prBody: 'Test PR body',
      autoMerge: false,
      mergeStrategy: 'squash' as const,
      reviewers: ['reviewer1'],
      labels: ['enhancement'],
      assignees: ['assignee1'],
      deleteBranch: true,
      reasoning: 'Test reasoning'
    };

    it('should create pull request successfully', async () => {
      const result = await gitOperations.createPullRequest(
        mockPRManagement,
        'feature-branch',
        'main'
      );

      expect(result.number).toBe(123);
      expect(result.url).toBe('https://github.com/test/repo/pull/123');
      expect(mockOctokitInstance.rest.pulls.create).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        title: 'Test PR',
        body: 'Test PR body',
        head: 'feature-branch',
        base: 'main'
      });
    });

    it('should add labels and reviewers', async () => {
      await gitOperations.createPullRequest(mockPRManagement, 'feature-branch');

      expect(mockOctokitInstance.rest.issues.addLabels).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        labels: ['enhancement']
      });
    });

    it('should handle auto-merge when enabled', async () => {
      const autoMergePR = { ...mockPRManagement, autoMerge: true };
      
      // setTimeout をモック
      jest.useFakeTimers();
      
      const createPromise = gitOperations.createPullRequest(autoMergePR, 'feature-branch');
      
      // 30秒進める
      jest.advanceTimersByTime(30000);
      
      await createPromise;
      
      expect(mockOctokitInstance.rest.pulls.get).toHaveBeenCalled();
      
      jest.useRealTimers();
    });
  });

  describe('getProjectContext', () => {
    it('should get project context successfully', async () => {
      const context = await gitOperations.getProjectContext();

      expect(context).toEqual({
        name: expect.any(String),
        type: expect.any(String),
        language: expect.any(String),
        framework: expect.any(String),
        dependencies: expect.any(Array),
        gitHistory: {
          recentCommits: ['Initial commit'],
          branches: ['main', 'feature-branch'],
          contributors: ['Test User']
        }
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle git operation failures', async () => {
      mockGit.commit.mockRejectedValue(new Error('Commit failed'));

      const result = await gitOperations.executeGitWorkflow();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Git操作が失敗しました');
    });

    it('should handle GitHub API failures', async () => {
      mockOctokitInstance.rest.pulls.create.mockRejectedValue(new Error('API Error'));

      await expect(
        gitOperations.createPullRequest(
          {
            prTitle: 'Test',
            prBody: 'Test',
            autoMerge: false,
            mergeStrategy: 'squash',
            reviewers: [],
            labels: [],
            assignees: [],
            deleteBranch: true,
            reasoning: 'Test'
          },
          'feature-branch'
        )
      ).rejects.toThrow('Failed to create pull request');
    });

    it('should handle subagent workflow errors gracefully', async () => {
      mockSubAgentManagerInstance.executeGitWorkflow.mockResolvedValue({
        safety: null,
        commitMessage: null,
        prManagement: null,
        executionTime: 100,
        errors: ['Subagent execution failed']
      });

      const result = await gitOperations.executeGitWorkflow();

      expect(result.success).toBe(true); // フォールバック処理で成功
      expect(result.warnings).toContain('Subagent execution failed');
    });
  });
});