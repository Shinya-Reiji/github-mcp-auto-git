/**
 * Independent SubAgent Implementation (非Claude Code依存)
 * 実際のAI分析機能を提供する独立したサブエージェント実装
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import type {
  SafetyAnalysisResult,
  CommitMessageResult,
  PRManagementResult,
  ChangeAnalysis
} from '../types/index.js';

// 危険なパターンの定数定義
const DANGEROUS_PATTERNS = {
  // 機密情報パターン
  secrets: [
    /(?:password|pwd|secret|key|token|auth|credential)\s*[:=]\s*['"][^'"]+['"]/gi,
    /(?:api_key|access_key|secret_key|private_key)\s*[:=]\s*['"][^'"]+['"]/gi,
    /(?:mongodb|mysql|postgres):\/\/\w+:\w+@[\w.-]+/gi,
    /sk-[a-zA-Z0-9]{48,}/gi, // OpenAI API key pattern
    /ghp_[a-zA-Z0-9]{36}/gi, // GitHub personal access token
    /glpat-[a-zA-Z0-9_-]{20}/gi // GitLab personal access token
  ],
  
  // 破壊的操作パターン
  destructive: [
    /rm\s+-rf\s+\//gi,
    /DROP\s+(?:TABLE|DATABASE)\s+/gi,
    /DELETE\s+FROM\s+\w+(?:\s+WHERE\s+1\s*=\s*1)?/gi,
    /\.delete\(\)\s*\.exec\(\)/gi,
    /process\.exit\(\d*\)/gi
  ],

  // 設定ファイルパターン
  config: [
    /\.env$/,
    /config\.json$/,
    /secrets\.yaml$/,
    /credentials\./,
    /\.pem$/,
    /\.key$/
  ]
};

// コミットメッセージの規則
const COMMIT_PATTERNS = {
  feature: /(?:add|create|implement|introduce)/i,
  fix: /(?:fix|resolve|repair|correct|patch)/i,
  update: /(?:update|modify|change|improve|enhance)/i,
  refactor: /(?:refactor|restructure|reorganize)/i,
  docs: /(?:doc|documentation|readme|comment)/i,
  test: /(?:test|spec|testing)/i,
  style: /(?:style|format|lint|prettier)/i,
  chore: /(?:chore|build|ci|deps|dependency)/i
};

export class IndependentSubAgents {
  /**
   * Git Safety Analyzer - 独立実装
   */
  async analyzeSafety(files: string[], workingDir: string): Promise<SafetyAnalysisResult> {
    const risks: Array<{ type: string; severity: 'low' | 'medium' | 'high' | 'critical'; description: string }> = [];
    const recommendations: string[] = [];
    let totalScore = 100;

    for (const file of files) {
      try {
        const filePath = join(workingDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        
        // 機密情報チェック
        for (const pattern of DANGEROUS_PATTERNS.secrets) {
          if (pattern.test(content)) {
            risks.push({
              type: 'secret_detected',
              severity: 'critical',
              description: `機密情報パターンが検出されました: ${file}`
            });
            totalScore -= 40;
            recommendations.push(`${file} から機密情報を削除してください`);
          }
        }

        // 破壊的操作チェック
        for (const pattern of DANGEROUS_PATTERNS.destructive) {
          if (pattern.test(content)) {
            risks.push({
              type: 'destructive_operation',
              severity: 'high',
              description: `破壊的操作が検出されました: ${file}`
            });
            totalScore -= 25;
            recommendations.push(`${file} の破壊的操作を確認してください`);
          }
        }

        // 大きなファイルサイズチェック
        const stats = await fs.stat(filePath);
        if (stats.size > 1024 * 1024) { // 1MB以上
          risks.push({
            type: 'large_file',
            severity: 'medium',
            description: `大きなファイルが検出されました: ${file} (${Math.round(stats.size / 1024)}KB)`
          });
          totalScore -= 10;
          recommendations.push(`${file} のファイルサイズを確認してください`);
        }

        // 設定ファイルチェック
        if (DANGEROUS_PATTERNS.config.some(pattern => pattern.test(file))) {
          risks.push({
            type: 'config_file',
            severity: 'medium',
            description: `設定ファイルが含まれています: ${file}`
          });
          totalScore -= 15;
          recommendations.push(`${file} に機密情報が含まれていないか確認してください`);
        }

      } catch (error) {
        // ファイル読み取りエラーは警告として扱う
        risks.push({
          type: 'file_access_error',
          severity: 'low',
          description: `ファイルアクセスエラー: ${file}`
        });
        totalScore -= 5;
      }
    }

    // スコア調整
    const safetyScore = Math.max(0, Math.min(100, totalScore));
    
    // レベル判定
    let level: 'SAFE' | 'WARNING' | 'DANGER';
    if (safetyScore >= 80) level = 'SAFE';
    else if (safetyScore >= 60) level = 'WARNING';
    else level = 'DANGER';

    // 自動承認判定
    const autoApprove = level === 'SAFE' && risks.every(risk => risk.severity !== 'critical');

    return {
      safetyScore,
      level,
      risks,
      recommendations,
      autoApprove,
      confidence: 0.9 // 独立実装での信頼度
    };
  }

  /**
   * Commit Message Generator - 独立実装
   */
  async generateCommitMessage(analysis: ChangeAnalysis, files: string[]): Promise<CommitMessageResult> {
    const { type, impact, description } = analysis;
    
    // コミットタイプをConventional Commitsに変換
    const conventionalType = this.mapToConventionalType(type, files);
    
    // 影響度に基づくスコープ判定
    const scope = this.determineScope(files, impact);
    
    // 日本語メッセージ生成
    const title = this.generateJapaneseTitle(type, description, files.length);
    const body = this.generateJapaneseBody(analysis, files);
    
    // Conventional Commits形式
    const conventional = scope 
      ? `${conventionalType}(${scope}): ${this.generateEnglishDescription(type, files)}`
      : `${conventionalType}: ${this.generateEnglishDescription(type, files)}`;

    return {
      title,
      body,
      conventional,
      confidence: 0.85
    };
  }

  /**
   * PR Management Agent - 独立実装
   */
  async generatePRManagement(
    analysis: ChangeAnalysis, 
    files: string[], 
    commitMessage: string
  ): Promise<PRManagementResult> {
    const { type, impact } = analysis;
    
    // PR自動マージ判定
    const autoMerge = this.shouldAutoMerge(type, impact, files);
    
    // マージ戦略決定
    const mergeStrategy = this.determineMergeStrategy(type, files.length);
    
    // レビュワー推薦
    const reviewers = this.recommendReviewers(type, files);
    
    // ラベル生成
    const labels = this.generateLabels(type, impact);
    
    // PR説明文生成
    const prBody = this.generatePRBody(analysis, files, commitMessage);

    return {
      prTitle: commitMessage.split('\n')[0] || 'Update files', // タイトル行を使用
      prBody,
      autoMerge,
      mergeStrategy,
      reviewers,
      labels,
      assignees: [], // 基本的には空
      deleteBranch: true, // 通常はブランチ削除
      reasoning: this.generateReasoning(autoMerge, type, impact)
    };
  }

  // Private helper methods

  private mapToConventionalType(type: string, files: string[]): string {
    // ファイル名からもヒントを得る
    const fileExtensions = files.map(f => f.split('.').pop() || '').join(' ');
    const hasTests = files.some(f => f.includes('test') || f.includes('spec'));
    const hasDocs = files.some(f => f.includes('README') || f.includes('.md'));
    
    if (hasTests) return 'test';
    if (hasDocs) return 'docs';
    
    switch (type) {
      case 'feature': return 'feat';
      case 'bugfix': return 'fix';
      case 'refactor': return 'refactor';
      case 'docs': return 'docs';
      case 'style': return 'style';
      case 'test': return 'test';
      case 'chore': return 'chore';
      default: return 'chore';
    }
  }

  private determineScope(files: string[], impact: string): string | null {
    // ディレクトリベースのスコープ判定
    const directories = files.map(f => f.split('/')[0]).filter(Boolean);
    const uniqueDirs = [...new Set(directories)];
    
    if (uniqueDirs.length === 1 && uniqueDirs[0]) {
      return uniqueDirs[0];
    }
    
    // 複数ディレクトリの場合は影響度で判定
    if (impact === 'high') return 'core';
    if (impact === 'medium') return 'feature';
    
    return null;
  }

  private generateJapaneseTitle(type: string, description: string, fileCount: number): string {
    const fileText = fileCount === 1 ? 'ファイル' : `${fileCount}個のファイル`;
    
    switch (type) {
      case 'feature':
        return `新機能: ${description}`;
      case 'bugfix':
        return `修正: ${description}`;
      case 'refactor':
        return `リファクタリング: ${fileText}を整理`;
      case 'docs':
        return `ドキュメント: ${description}`;
      case 'test':
        return `テスト: ${fileText}のテストを追加・更新`;
      case 'style':
        return `スタイル: ${fileText}のフォーマットを調整`;
      default:
        return `更新: ${fileText}を変更`;
    }
  }

  private generateJapaneseBody(analysis: ChangeAnalysis, files: string[]): string {
    const { metrics, impact } = analysis;
    
    let body = `## 変更内容\n\n`;
    body += `- 変更ファイル数: ${files.length}\n`;
    body += `- 追加行数: ${metrics?.linesAdded || 0}\n`;
    body += `- 削除行数: ${metrics?.linesDeleted || 0}\n`;
    body += `- 影響度: ${impact}\n\n`;
    
    body += `## 変更ファイル\n\n`;
    files.forEach(file => {
      body += `- \`${file}\`\n`;
    });
    
    return body;
  }

  private generateEnglishDescription(type: string, files: string[]): string {
    const fileCount = files.length;
    const mainFile = files[0];
    
    switch (type) {
      case 'feature':
        return fileCount === 1 ? `add new feature in ${mainFile}` : `implement new features across ${fileCount} files`;
      case 'bugfix':
        return fileCount === 1 ? `fix issue in ${mainFile}` : `resolve issues in ${fileCount} files`;
      case 'refactor':
        return fileCount === 1 ? `refactor ${mainFile}` : `restructure ${fileCount} files`;
      case 'docs':
        return fileCount === 1 ? `update documentation in ${mainFile}` : `improve documentation`;
      case 'test':
        return fileCount === 1 ? `add tests for ${mainFile}` : `enhance test coverage`;
      default:
        return fileCount === 1 ? `update ${mainFile}` : `modify ${fileCount} files`;
    }
  }

  private shouldAutoMerge(type: string, impact: string, files: string[]): boolean {
    // 危険度の高い変更は自動マージしない
    if (impact === 'high') return false;
    if (files.length > 10) return false;
    
    // 安全な変更のみ自動マージ
    const safeTypes = ['docs', 'style', 'test'];
    if (safeTypes.includes(type) && impact === 'low') return true;
    
    return false;
  }

  private determineMergeStrategy(type: string, fileCount: number): 'merge' | 'squash' | 'rebase' {
    // 小さな変更はsquash
    if (fileCount <= 3) return 'squash';
    
    // 機能追加は通常のmerge
    if (type === 'feature') return 'merge';
    
    // その他はsquash
    return 'squash';
  }

  private recommendReviewers(type: string, files: string[]): string[] {
    // 実際の環境では設定ファイルから読み込む
    const reviewers: string[] = [];
    
    // 重要な変更には必ずレビュワーを設定
    if (files.some(f => f.includes('core') || f.includes('main'))) {
      reviewers.push('tech-lead');
    }
    
    // セキュリティ関連
    if (files.some(f => f.includes('auth') || f.includes('security'))) {
      reviewers.push('security-team');
    }
    
    return reviewers;
  }

  private generateLabels(type: string, impact: string): string[] {
    const labels: string[] = [];
    
    // タイプベースラベル
    switch (type) {
      case 'feature':
        labels.push('enhancement');
        break;
      case 'bugfix':
        labels.push('bug');
        break;
      case 'docs':
        labels.push('documentation');
        break;
      case 'test':
        labels.push('testing');
        break;
    }
    
    // 影響度ラベル
    switch (impact) {
      case 'high':
        labels.push('high-impact');
        break;
      case 'medium':
        labels.push('medium-impact');
        break;
      case 'low':
        labels.push('low-impact');
        break;
    }
    
    return labels;
  }

  private generatePRBody(analysis: ChangeAnalysis, files: string[], commitMessage: string): string {
    const { type, impact, metrics } = analysis;
    
    let body = `## 概要\n\n${analysis.description}\n\n`;
    body += `## 変更詳細\n\n`;
    body += `- **タイプ**: ${type}\n`;
    body += `- **影響度**: ${impact}\n`;
    body += `- **ファイル数**: ${files.length}\n`;
    body += `- **追加行**: ${metrics?.linesAdded || 0}\n`;
    body += `- **削除行**: ${metrics?.linesDeleted || 0}\n\n`;
    
    body += `## チェックリスト\n\n`;
    body += `- [ ] コードレビュー完了\n`;
    body += `- [ ] テスト実行確認\n`;
    body += `- [ ] ドキュメント更新確認\n`;
    
    if (impact === 'high') {
      body += `- [ ] セキュリティレビュー完了\n`;
      body += `- [ ] パフォーマンステスト実行\n`;
    }
    
    return body;
  }

  private generateReasoning(autoMerge: boolean, type: string, impact: string): string {
    if (autoMerge) {
      return `安全な変更 (${type}, ${impact}影響) のため自動マージ対象です`;
    } else {
      const reasons = [];
      if (impact === 'high') reasons.push('高影響度の変更');
      if (type === 'feature') reasons.push('新機能追加');
      if (type === 'bugfix') reasons.push('バグ修正');
      
      return `${reasons.join(', ')}のためレビューが必要です`;
    }
  }
}