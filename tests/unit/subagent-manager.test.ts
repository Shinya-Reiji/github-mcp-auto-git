import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import { SubAgentManager } from '../../src/core/subagent-manager';
import type { SafetyAnalysisResult, CommitMessageResult, PRManagementResult } from '../../src/types/index';

// モック設定
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    readdir: jest.fn()
  }
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('SubAgentManager', () => {
  let subAgentManager: SubAgentManager;
  const testAgentsPath = './test-agents';

  beforeEach(() => {
    subAgentManager = new SubAgentManager(testAgentsPath);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('loadAgent', () => {
    it('should load agent from markdown file with valid frontmatter', async () => {
      const mockContent = `---
name: "Test Agent"
description: "テスト用エージェント"
version: "1.0.0"
tools: ["file_read", "shell_exec"]
---

# Test Agent

これはテスト用のエージェントです。`;

      mockFs.readFile.mockResolvedValue(mockContent);

      const agent = await subAgentManager.loadAgent('test-agent');

      expect(agent).toEqual({
        name: 'Test Agent',
        description: 'テスト用エージェント',
        version: '1.0.0',
        tools: ['file_read', 'shell_exec'],
        prompt: expect.stringContaining('# Test Agent')
      });
    });

    it('should throw error for invalid frontmatter', async () => {
      const mockContent = 'Invalid content without frontmatter';
      mockFs.readFile.mockResolvedValue(mockContent);

      await expect(subAgentManager.loadAgent('invalid-agent')).rejects.toThrow(
        'Invalid agent file format: invalid-agent'
      );
    });

    it('should cache loaded agents', async () => {
      const mockContent = `---
name: "Cached Agent"
description: "キャッシュテスト"
version: "1.0.0"
---
Content`;

      mockFs.readFile.mockResolvedValue(mockContent);

      // 初回ロード
      await subAgentManager.loadAgent('cached-agent');
      
      // 2回目のロード
      const agent = await subAgentManager.loadAgent('cached-agent');

      expect(mockFs.readFile).toHaveBeenCalledTimes(1);
      expect(agent.name).toBe('Cached Agent');
    });
  });

  describe('executeAgent', () => {
    beforeEach(() => {
      const mockContent = `---
name: "Test Agent"
description: "テスト用エージェント"
version: "1.0.0"
---
Test prompt`;
      mockFs.readFile.mockResolvedValue(mockContent);
    });

    it('should execute agent and return fallback result', async () => {
      const result = await subAgentManager.executeAgent<SafetyAnalysisResult>(
        'git-safety-analyzer',
        'テスト実行',
        { files: ['test.ts'] }
      );

      expect(result).toEqual({
        agentName: 'Test Agent',
        result: {
          safetyScore: 75,
          level: 'SAFE',
          risks: [],
          recommendations: ['Claude Codeのサブエージェント機能を使用することを推奨します'],
          autoApprove: true,
          confidence: 0.6
        },
        executionTime: expect.any(Number),
        confidence: 0.6
      });
    });

    it('should handle agent execution errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const result = await subAgentManager.executeAgent(
        'nonexistent-agent',
        'テスト実行'
      );

      expect(result.error).toBeDefined();
      expect(result.result).toBeNull();
      expect(result.confidence).toBe(0);
    });
  });

  describe('executeParallel', () => {
    beforeEach(() => {
      const mockContent = `---
name: "Test Agent"
description: "テスト用エージェント"
version: "1.0.0"
---
Test prompt`;
      mockFs.readFile.mockResolvedValue(mockContent);
    });

    it('should execute multiple agents in parallel', async () => {
      const executions = [
        {
          agentName: 'git-safety-analyzer',
          userPrompt: 'Safety check',
          context: { files: ['test.ts'] }
        },
        {
          agentName: 'commit-message-generator',
          userPrompt: 'Generate message',
          context: { changes: {} }
        }
      ];

      const results = await subAgentManager.executeParallel(executions);

      expect(results).toHaveLength(2);
      expect(results[0]?.agentName).toBe('Test Agent');
      expect(results[1]?.agentName).toBe('Test Agent');
    });
  });

  describe('generateFallbackResult', () => {
    it('should generate appropriate fallback for safety analyzer', async () => {
      const result = await subAgentManager.executeAgent<SafetyAnalysisResult>(
        'git-safety-analyzer',
        'test'
      );

      const safetyResult = result.result as SafetyAnalysisResult;
      expect(safetyResult.safetyScore).toBe(75);
      expect(safetyResult.level).toBe('SAFE');
      expect(safetyResult.autoApprove).toBe(true);
    });

    it('should generate appropriate fallback for commit message generator', async () => {
      const result = await subAgentManager.executeAgent<CommitMessageResult>(
        'commit-message-generator',
        'test'
      );

      const commitResult = result.result as CommitMessageResult;
      expect(commitResult.title).toBe('変更: ファイルを更新');
      expect(commitResult.conventional).toBe('chore: update files');
    });

    it('should generate appropriate fallback for PR management agent', async () => {
      const result = await subAgentManager.executeAgent<PRManagementResult>(
        'pr-management-agent',
        'test'
      );

      const prResult = result.result as PRManagementResult;
      expect(prResult.prTitle).toBe('変更: ファイル更新');
      expect(prResult.mergeStrategy).toBe('squash');
      expect(prResult.autoMerge).toBe(false);
    });
  });

  describe('getAgentStatus', () => {
    it('should return agent status with available agents', async () => {
      mockFs.readdir.mockResolvedValue(['test-agent.md', 'another-agent.md', 'not-markdown.txt'] as any);
      mockFs.readFile.mockResolvedValue(`---
name: "Test Agent"
description: "テスト"
version: "1.0.0"
---
Content`);

      const status = await subAgentManager.getAgentStatus();

      expect(status.available).toContain('test-agent');
      expect(status.available).toContain('another-agent');
      expect(status.available).not.toContain('not-markdown');
      expect(status.errors).toEqual([]);
    });

    it('should handle directory read errors', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Directory not found'));

      const status = await subAgentManager.getAgentStatus();

      expect(status.available).toEqual([]);
      expect(status.errors).toContain(expect.stringContaining('Failed to read agents directory'));
    });
  });
});