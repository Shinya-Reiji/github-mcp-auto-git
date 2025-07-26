import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { IndependentSubAgents } from '../../src/core/independent-subagents';
import type { ChangeAnalysis } from '../../src/types/index';

describe('IndependentSubAgents', () => {
  let tempDir: string;
  let subAgents: IndependentSubAgents;

  beforeAll(async () => {
    // 一時ディレクトリを作成
    tempDir = await fs.mkdtemp(join(tmpdir(), 'subagent-test-'));
    subAgents = new IndependentSubAgents();
  });

  afterAll(async () => {
    // 一時ディレクトリをクリーンアップ
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error);
    }
  });

  describe('analyzeSafety', () => {
    it('should detect secret patterns in files', async () => {
      // 機密情報を含むファイルを作成
      const secretFile = join(tempDir, 'config.ts');
      await fs.writeFile(secretFile, `
        const config = {
          apiKey: "sk-1234567890abcdef1234567890abcdef12345678",
          password: "secret123",
          dbUrl: "mongodb://user:pass@localhost:27017/db"
        };
      `);

      const result = await subAgents.analyzeSafety(['config.ts'], tempDir);

      expect(result.safetyScore).toBeLessThan(80);
      expect(result.level).toBe('DANGER');
      expect(result.risks.length).toBeGreaterThan(0);
      expect(result.risks.some(risk => risk.type === 'secret_detected')).toBe(true);
      expect(result.autoApprove).toBe(false);
    });

    it('should detect large files', async () => {
      // 大きなファイルを作成 (1MB以上)
      const largeFile = join(tempDir, 'large.txt');
      const largeContent = 'x'.repeat(1024 * 1024 + 1);
      await fs.writeFile(largeFile, largeContent);

      const result = await subAgents.analyzeSafety(['large.txt'], tempDir);

      expect(result.risks.some(risk => risk.type === 'large_file')).toBe(true);
    });

    it('should approve safe files', async () => {
      // 安全なファイルを作成
      const safeFile = join(tempDir, 'safe.ts');
      await fs.writeFile(safeFile, `
        export function addNumbers(a: number, b: number): number {
          return a + b;
        }
      `);

      const result = await subAgents.analyzeSafety(['safe.ts'], tempDir);

      expect(result.safetyScore).toBeGreaterThan(80);
      expect(result.level).toBe('SAFE');
      expect(result.autoApprove).toBe(true);
    });
  });

  describe('generateCommitMessage', () => {
    it('should generate appropriate commit message for feature', async () => {
      const analysis: ChangeAnalysis = {
        type: 'feature',
        impact: 'medium',
        files: ['src/components/Button.tsx'],
        description: '新しいボタンコンポーネントを追加',
        metrics: {
          linesAdded: 50,
          linesDeleted: 0,
          complexity: 3
        }
      };

      const result = await subAgents.generateCommitMessage(analysis, analysis.files);

      expect(result.title).toContain('新機能');
      expect(result.conventional).toMatch(/^feat(\(.*\))?: /);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should generate appropriate commit message for bugfix', async () => {
      const analysis: ChangeAnalysis = {
        type: 'bugfix',
        impact: 'low',
        files: ['src/utils/helpers.ts'],
        description: 'バグを修正',
        metrics: {
          linesAdded: 5,
          linesDeleted: 3,
          complexity: 1
        }
      };

      const result = await subAgents.generateCommitMessage(analysis, analysis.files);

      expect(result.title).toContain('修正');
      expect(result.conventional).toMatch(/^fix(\(.*\))?: /);
    });

    it('should handle files without metrics', async () => {
      const analysis: ChangeAnalysis = {
        type: 'docs',
        impact: 'low',
        files: ['README.md'],
        description: 'ドキュメント更新'
      };

      const result = await subAgents.generateCommitMessage(analysis, analysis.files);

      expect(result.title).toBeDefined();
      expect(result.conventional).toMatch(/^docs(\(.*\))?: /);
      expect(result.body).toContain('追加行数: 0');
      expect(result.body).toContain('削除行数: 0');
    });
  });

  describe('generatePRManagement', () => {
    it('should recommend auto-merge for safe changes', async () => {
      const analysis: ChangeAnalysis = {
        type: 'docs',
        impact: 'low',
        files: ['README.md'],
        description: 'ドキュメント更新'
      };

      const result = await subAgents.generatePRManagement(analysis, analysis.files, 'docs: update README');

      expect(result.autoMerge).toBe(true);
      expect(result.mergeStrategy).toBe('squash');
      expect(result.labels).toContain('documentation');
      expect(result.labels).toContain('low-impact');
    });

    it('should not recommend auto-merge for high-impact changes', async () => {
      const analysis: ChangeAnalysis = {
        type: 'feature',
        impact: 'high',
        files: Array.from({ length: 15 }, (_, i) => `src/core/file${i}.ts`),
        description: '大規模な機能追加'
      };

      const result = await subAgents.generatePRManagement(analysis, analysis.files, 'feat: major feature addition');

      expect(result.autoMerge).toBe(false);
      expect(result.labels).toContain('enhancement');
      expect(result.labels).toContain('high-impact');
      expect(result.reasoning).toContain('レビューが必要');
    });

    it('should generate appropriate PR body', async () => {
      const analysis: ChangeAnalysis = {
        type: 'feature',
        impact: 'medium',
        files: ['src/api/users.ts', 'src/types/user.ts'],
        description: 'ユーザー管理機能を追加',
        metrics: {
          linesAdded: 100,
          linesDeleted: 10,
          complexity: 5
        }
      };

      const result = await subAgents.generatePRManagement(analysis, analysis.files, 'feat: add user management');

      expect(result.prBody).toContain('## 概要');
      expect(result.prBody).toContain('## 変更詳細');
      expect(result.prBody).toContain('## チェックリスト');
      expect(result.prBody).toContain('**追加行**: 100');
      expect(result.prBody).toContain('**削除行**: 10');
    });
  });

  describe('edge cases', () => {
    it('should handle empty file list', async () => {
      const result = await subAgents.analyzeSafety([], tempDir);

      expect(result.safetyScore).toBe(100);
      expect(result.level).toBe('SAFE');
      expect(result.risks).toHaveLength(0);
    });

    it('should handle non-existent files gracefully', async () => {
      const result = await subAgents.analyzeSafety(['non-existent.ts'], tempDir);

      expect(result.risks.some(risk => risk.type === 'file_access_error')).toBe(true);
      expect(result.safetyScore).toBeLessThan(100);
    });
  });
});