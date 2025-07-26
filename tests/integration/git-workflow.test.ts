import { describe, it, expect, jest, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { GitOperations } from '../../src/core/git-operations';
import type { GitConfig } from '../../src/types/index';
import simpleGit from 'simple-git';

describe('Git Workflow Integration Tests', () => {
  let tempDir: string;
  let gitOperations: GitOperations;
  let mockConfig: GitConfig;

  beforeAll(async () => {
    // 一時ディレクトリを作成
    tempDir = await fs.mkdtemp(join(tmpdir(), 'git-test-'));
    
    mockConfig = {
      enabled: true,
      triggers: ['save'],
      paths: ['**/*'],
      subAgents: {
        gitSafetyAnalyzer: { enabled: true, safetyThreshold: 0.85 },
        commitMessageGenerator: { enabled: true, language: 'ja', style: 'friendly' },
        prManagementAgent: { enabled: true, autoMergeThreshold: 0.85 }
      },
      notifications: { success: true, warnings: true, detailed: false },
      github: { owner: 'test-owner', repo: 'test-repo', token: '' } // トークンなしでテスト
    };
    
    // テスト用のGitリポジトリを初期化
    const git = simpleGit(tempDir);
    await git.init();
    await git.addConfig('user.name', 'Test User');
    await git.addConfig('user.email', 'test@example.com');
    
    gitOperations = new GitOperations(mockConfig, tempDir);
  });

  afterAll(async () => {
    // 一時ディレクトリをクリーンアップ
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // コンソール出力をモック
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Real Git Operations', () => {
    it('should initialize git operations', async () => {
      await expect(gitOperations.initialize()).resolves.not.toThrow();
    });

    it('should analyze changes in empty repository', async () => {
      const analysis = await gitOperations.analyzeChanges();
      
      expect(analysis).toEqual({
        type: expect.any(String),
        impact: expect.any(String),
        files: expect.any(Array),
        description: expect.any(String),
        metrics: {
          linesAdded: expect.any(Number),
          linesDeleted: expect.any(Number),
          complexity: expect.any(Number)
        }
      });
    });

    it('should handle workflow with no changes', async () => {
      const result = await gitOperations.executeGitWorkflow();
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('変更がありません');
    });

    it('should execute workflow with test file', async () => {
      // テストファイルを作成
      const testFile = join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'Test content');
      
      const result = await gitOperations.executeGitWorkflow(['test.txt'], {
        autoCommit: true,
        autoPush: false,
        createPR: false
      });
      
      expect(result.success).toBe(true);
      expect(result.details.commit).toBeDefined();
      expect(result.details.commit).toMatch(/^[a-f0-9]+$/); // Git ハッシュパターン
    });

    it('should detect different change types', async () => {
      // 機能追加ファイル
      const featureFile = join(tempDir, 'feature.ts');
      await fs.writeFile(featureFile, `
export function newFeature() {
  console.log('New feature added');
}
      `);
      
      const analysis = await gitOperations.analyzeChanges(['feature.ts']);
      expect(analysis.type).toBe('feature');
      
      // バグ修正ファイル
      const bugfixFile = join(tempDir, 'bugfix.ts');
      await fs.writeFile(bugfixFile, `
// Fix for issue #123
export function fixBug() {
  // Fixed the error in calculation
  return 42;
}
      `);
      
      const bugfixAnalysis = await gitOperations.analyzeChanges(['bugfix.ts']);
      expect(bugfixAnalysis.type).toBe('bugfix');
    });

    it('should calculate impact levels correctly', async () => {
      // 小規模変更
      const smallFile = join(tempDir, 'small.ts');
      await fs.writeFile(smallFile, 'const x = 1;');
      
      const smallAnalysis = await gitOperations.analyzeChanges(['small.ts']);
      expect(smallAnalysis.impact).toBe('low');
      
      // 大規模変更
      const largeContent = Array(100).fill('console.log("large change");').join('\n');
      const largeFile = join(tempDir, 'large.ts');
      await fs.writeFile(largeFile, largeContent);
      
      const largeAnalysis = await gitOperations.analyzeChanges(['large.ts']);
      expect(largeAnalysis.impact).toBe('medium');
    });

    it('should handle multiple files workflow', async () => {
      // 複数ファイルを作成
      const files = ['file1.js', 'file2.js', 'file3.js'];
      
      for (const file of files) {
        await fs.writeFile(join(tempDir, file), `console.log('${file}');`);
      }
      
      const result = await gitOperations.executeGitWorkflow(files, {
        autoCommit: true,
        autoPush: false,
        createPR: false
      });
      
      expect(result.success).toBe(true);
      expect(result.details.commit).toBeDefined();
    });

    it('should get accurate project context', async () => {
      // package.json を作成
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'typescript': '^5.0.0',
          'react': '^18.0.0'
        }
      };
      
      await fs.writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      
      const context = await gitOperations.getProjectContext();
      
      expect(context.name).toBe('test-project');
      expect(context.language).toBe('TypeScript');
      expect(context.framework).toBe('React');
      expect(context.dependencies).toContain('typescript');
      expect(context.dependencies).toContain('react');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle invalid git repository', async () => {
      const invalidDir = join(tempDir, 'invalid');
      await fs.mkdir(invalidDir);
      
      const invalidGitOps = new GitOperations(mockConfig, invalidDir);
      
      // Git リポジトリではないディレクトリでの操作をテスト
      const result = await invalidGitOps.executeGitWorkflow();
      expect(result.success).toBe(false);
    });

    it('should handle permission errors', async () => {
      // 読み取り専用ファイルを作成
      const readOnlyFile = join(tempDir, 'readonly.txt');
      await fs.writeFile(readOnlyFile, 'readonly content');
      await fs.chmod(readOnlyFile, 0o444);
      
      try {
        const result = await gitOperations.executeGitWorkflow(['readonly.txt']);
        // Git add は成功する可能性があるので、結果をチェック
        expect(result).toBeDefined();
      } finally {
        // クリーンアップのために権限を戻す
        await fs.chmod(readOnlyFile, 0o644);
      }
    });

    it('should handle network timeouts gracefully', async () => {
      // ネットワーク操作のタイムアウトをシミュレート
      const networkConfig = {
        ...mockConfig,
        github: {
          ...mockConfig.github,
          token: 'invalid-token'
        }
      };
      
      const networkGitOps = new GitOperations(networkConfig, tempDir);
      await networkGitOps.initialize();
      
      // ファイルを作成してPR作成を試行
      await fs.writeFile(join(tempDir, 'network-test.txt'), 'network test');
      
      const result = await networkGitOps.executeGitWorkflow(['network-test.txt'], {
        autoCommit: true,
        autoPush: true,
        createPR: true
      });
      
      // GitHub操作は失敗するが、ローカルのGit操作は成功する
      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
    });
  });

  describe('Performance and Resource Management', () => {
    it('should complete workflow within reasonable time', async () => {
      const startTime = Date.now();
      
      await fs.writeFile(join(tempDir, 'perf-test.txt'), 'performance test');
      
      const result = await gitOperations.executeGitWorkflow(['perf-test.txt'], {
        autoCommit: true,
        autoPush: false,
        createPR: false
      });
      
      const executionTime = Date.now() - startTime;
      
      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(10000); // 10秒以内
      expect(result.executionTime).toBeDefined();
    });

    it('should handle large files efficiently', async () => {
      // 1MBのファイルを作成
      const largeContent = 'x'.repeat(1024 * 1024);
      const largeFile = join(tempDir, 'large-file.txt');
      await fs.writeFile(largeFile, largeContent);
      
      const startTime = Date.now();
      const analysis = await gitOperations.analyzeChanges(['large-file.txt']);
      const analysisTime = Date.now() - startTime;
      
      expect(analysis).toBeDefined();
      expect(analysisTime).toBeLessThan(5000); // 5秒以内
    });
  });
});