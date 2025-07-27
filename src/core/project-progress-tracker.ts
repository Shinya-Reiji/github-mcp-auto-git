/**
 * Project Progress Tracker (PPT)
 * プロジェクト進捗の自動追跡・ドキュメント更新システム
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import crypto from 'crypto';

export interface ProgressMetrics {
  // プロジェクト基本情報
  projectName: string;
  version: string;
  lastUpdated: Date;
  
  // 進捗状況
  completedTasks: number;
  totalTasks: number;
  completionPercentage: number;
  
  // 品質メトリクス
  codeQualityScore: number;
  testCoverage: number;
  documentationCoverage: number;
  
  // パフォーマンス
  buildTime: number;
  testExecutionTime: number;
  deploymentTime: number;
  
  // アクティビティ
  commitsToday: number;
  commitsThisWeek: number;
  activeDays: number;
  
  // チーム（個人開発でも将来拡張用）
  contributors: string[];
  activeContributors: number;
}

export interface ProgressChange {
  id: string;
  timestamp: Date;
  type: 'task_completed' | 'feature_added' | 'bug_fixed' | 'refactoring' | 'documentation' | 'test_added';
  description: string;
  impact: 'low' | 'medium' | 'high';
  filesChanged: string[];
  linesAdded: number;
  linesRemoved: number;
  author: string;
  tags: string[];
}

export interface ProgressReport {
  metrics: ProgressMetrics;
  recentChanges: ProgressChange[];
  milestones: {
    completed: string[];
    upcoming: string[];
    overdue: string[];
  };
  insights: {
    productivity: string;
    quality: string;
    velocity: string;
    recommendations: string[];
  };
  generatedAt: Date;
}

export interface PPTConfig {
  enabled: boolean;
  trackingLevel: 'basic' | 'detailed' | 'comprehensive';
  autoUpdateDocs: boolean;
  reportFormat: 'markdown' | 'json' | 'both';
  outputPath: string;
  gitIntegration: boolean;
  realtimeUpdates: boolean;
}

export class ProjectProgressTracker {
  private workingDir: string;
  private config: PPTConfig;
  private progressHistory: ProgressChange[] = [];
  private metricsCache: Map<string, any> = new Map();

  constructor(workingDir: string = process.cwd(), config?: Partial<PPTConfig>) {
    this.workingDir = workingDir;
    this.config = this.createDefaultConfig(config);
    this.loadProgressHistory();
  }

  /**
   * 現在の進捗状況を分析・更新
   */
  async updateProgress(changes?: {
    type: ProgressChange['type'];
    description: string;
    filesChanged: string[];
    impact?: 'low' | 'medium' | 'high';
  }): Promise<ProgressReport> {
    if (!this.config.enabled) {
      throw new Error('Project Progress Tracker is disabled');
    }

    try {
      console.log('📊 Progress Tracker 実行中...');

      // 並列でメトリクス収集
      const [currentMetrics, recentChanges, milestones] = await Promise.all([
        this.collectCurrentMetrics(),
        this.getRecentChanges(),
        this.analyzeMilestones()
      ]);

      // 変更があれば記録
      if (changes) {
        const change = await this.recordChange(changes);
        recentChanges.unshift(change);
        this.progressHistory.unshift(change);
      }

      // インサイト生成
      const insights = this.generateInsights(currentMetrics, recentChanges);

      const report: ProgressReport = {
        metrics: currentMetrics,
        recentChanges: recentChanges.slice(0, 20), // 直近20件
        milestones,
        insights,
        generatedAt: new Date()
      };

      // ドキュメント自動更新
      if (this.config.autoUpdateDocs) {
        await this.updateProgressDocuments(report);
      }

      // 進捗履歴保存
      await this.saveProgressHistory();

      console.log(`✅ Progress Tracker 完了 (進捗: ${currentMetrics.completionPercentage}%)`);

      return report;

    } catch (error) {
      console.error('❌ Progress Tracker エラー:', error);
      throw error;
    }
  }

  /**
   * 現在のメトリクス収集
   */
  private async collectCurrentMetrics(): Promise<ProgressMetrics> {
    try {
      // package.jsonから基本情報取得
      const packageInfo = await this.getPackageInfo();
      
      // Git統計収集
      const gitStats = await this.collectGitStatistics();
      
      // ファイル統計収集
      const fileStats = await this.collectFileStatistics();
      
      // タスク進捗収集
      const taskProgress = await this.collectTaskProgress();

      const metrics: ProgressMetrics = {
        projectName: packageInfo.name || 'Unknown Project',
        version: packageInfo.version || '0.0.0',
        lastUpdated: new Date(),
        
        completedTasks: taskProgress.completed,
        totalTasks: taskProgress.total,
        completionPercentage: taskProgress.total > 0 ? 
          Math.round((taskProgress.completed / taskProgress.total) * 100) : 0,
        
        codeQualityScore: await this.calculateCodeQualityScore(),
        testCoverage: await this.calculateTestCoverage(),
        documentationCoverage: await this.calculateDocumentationCoverage(),
        
        buildTime: fileStats.buildTime || 0,
        testExecutionTime: fileStats.testTime || 0,
        deploymentTime: 0, // 実装により計測
        
        commitsToday: gitStats.commitsToday,
        commitsThisWeek: gitStats.commitsThisWeek,
        activeDays: gitStats.activeDays,
        
        contributors: gitStats.contributors,
        activeContributors: gitStats.activeContributors
      };

      return metrics;

    } catch (error) {
      console.warn('⚠️ メトリクス収集エラー:', error);
      return this.getDefaultMetrics();
    }
  }

  /**
   * 変更記録
   */
  private async recordChange(changes: {
    type: ProgressChange['type'];
    description: string;
    filesChanged: string[];
    impact?: 'low' | 'medium' | 'high';
  }): Promise<ProgressChange> {
    const change: ProgressChange = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: changes.type,
      description: changes.description,
      impact: changes.impact || 'medium',
      filesChanged: changes.filesChanged,
      linesAdded: await this.calculateLinesChanged(changes.filesChanged, 'added'),
      linesRemoved: await this.calculateLinesChanged(changes.filesChanged, 'removed'),
      author: await this.getCurrentAuthor(),
      tags: this.generateTags(changes)
    };

    return change;
  }

  /**
   * インサイト生成
   */
  private generateInsights(metrics: ProgressMetrics, recentChanges: ProgressChange[]): ProgressReport['insights'] {
    const productivity = this.analyzeProductivity(metrics, recentChanges);
    const quality = this.analyzeQuality(metrics);
    const velocity = this.analyzeVelocity(recentChanges);
    const recommendations = this.generateRecommendations(metrics, recentChanges);

    return {
      productivity,
      quality,
      velocity,
      recommendations
    };
  }

  /**
   * 生産性分析
   */
  private analyzeProductivity(metrics: ProgressMetrics, recentChanges: ProgressChange[]): string {
    const recentActivity = recentChanges.filter(c => 
      Date.now() - c.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000 // 7日以内
    ).length;

    if (recentActivity >= 10) {
      return 'High - 非常に活発な開発活動が継続しています';
    } else if (recentActivity >= 5) {
      return 'Medium - 安定した開発ペースを維持しています';
    } else if (recentActivity >= 2) {
      return 'Low - 開発活動が少し低下しています';
    } else {
      return 'Very Low - 開発活動が停滞気味です';
    }
  }

  /**
   * 品質分析
   */
  private analyzeQuality(metrics: ProgressMetrics): string {
    const qualityScore = (metrics.codeQualityScore + metrics.testCoverage + metrics.documentationCoverage) / 3;

    if (qualityScore >= 85) {
      return 'Excellent - 高品質な実装が維持されています';
    } else if (qualityScore >= 70) {
      return 'Good - 品質基準を満たしています';
    } else if (qualityScore >= 50) {
      return 'Fair - 品質向上の余地があります';
    } else {
      return 'Poor - 品質改善が必要です';
    }
  }

  /**
   * 開発速度分析
   */
  private analyzeVelocity(recentChanges: ProgressChange[]): string {
    const lastWeek = recentChanges.filter(c => 
      Date.now() - c.timestamp.getTime() < 7 * 24 * 60 * 60 * 1000
    );
    
    const avgImpact = lastWeek.reduce((sum, change) => {
      const impactScore = { low: 1, medium: 2, high: 3 }[change.impact];
      return sum + impactScore;
    }, 0) / Math.max(lastWeek.length, 1);

    if (avgImpact >= 2.5) {
      return 'Fast - 高インパクトな変更が頻繁に実装されています';
    } else if (avgImpact >= 2) {
      return 'Steady - 安定した開発速度を維持しています';
    } else if (avgImpact >= 1.5) {
      return 'Slow - 開発速度が低下しています';
    } else {
      return 'Stalled - 開発が停滞しています';
    }
  }

  /**
   * 推奨事項生成
   */
  private generateRecommendations(metrics: ProgressMetrics, recentChanges: ProgressChange[]): string[] {
    const recommendations: string[] = [];

    // 進捗率に基づく推奨
    if (metrics.completionPercentage < 50) {
      recommendations.push('プロジェクトの進捗を加速するため、重要なタスクに集中することを推奨します');
    } else if (metrics.completionPercentage > 90) {
      recommendations.push('プロジェクトがほぼ完了です。リリース準備とドキュメント整備を検討してください');
    }

    // 品質に基づく推奨
    if (metrics.testCoverage < 70) {
      recommendations.push('テストカバレッジが低いです。テストの追加を検討してください');
    }

    if (metrics.documentationCoverage < 60) {
      recommendations.push('ドキュメントが不足しています。README、APIドキュメントの更新を推奨します');
    }

    // アクティビティに基づく推奨
    const recentActivity = recentChanges.filter(c => 
      Date.now() - c.timestamp.getTime() < 3 * 24 * 60 * 60 * 1000
    );

    if (recentActivity.length === 0) {
      recommendations.push('最近の活動が少ないです。定期的な開発継続を推奨します');
    }

    // 変更の種類に基づく推奨
    const changeTypes = recentChanges.map(c => c.type);
    const hasTests = changeTypes.includes('test_added');
    const hasRefactoring = changeTypes.includes('refactoring');

    if (!hasTests && recentChanges.length > 5) {
      recommendations.push('新機能追加時はテストの追加も検討してください');
    }

    if (!hasRefactoring && recentChanges.length > 10) {
      recommendations.push('コードのリファクタリングを検討し、技術的負債を削減してください');
    }

    return recommendations;
  }

  /**
   * 進捗ドキュメント更新
   */
  private async updateProgressDocuments(report: ProgressReport): Promise<void> {
    try {
      const outputDir = join(this.workingDir, this.config.outputPath);
      await fs.mkdir(outputDir, { recursive: true });

      // Markdown形式のレポート生成
      if (this.config.reportFormat === 'markdown' || this.config.reportFormat === 'both') {
        const markdownReport = this.generateMarkdownReport(report);
        await fs.writeFile(join(outputDir, 'PROGRESS.md'), markdownReport, 'utf-8');
      }

      // JSON形式のレポート生成
      if (this.config.reportFormat === 'json' || this.config.reportFormat === 'both') {
        const jsonReport = JSON.stringify(report, null, 2);
        await fs.writeFile(join(outputDir, 'progress.json'), jsonReport, 'utf-8');
      }

      console.log('📄 進捗ドキュメントを更新しました');

    } catch (error) {
      console.warn('⚠️ ドキュメント更新エラー:', error);
    }
  }

  /**
   * Markdownレポート生成
   */
  private generateMarkdownReport(report: ProgressReport): string {
    const { metrics, recentChanges, milestones, insights } = report;

    return `# Project Progress Report

Generated: ${report.generatedAt.toISOString()}

## 📊 Current Metrics

- **Project**: ${metrics.projectName} v${metrics.version}
- **Progress**: ${metrics.completedTasks}/${metrics.totalTasks} tasks (${metrics.completionPercentage}%)
- **Quality Score**: ${metrics.codeQualityScore}/100
- **Test Coverage**: ${metrics.testCoverage}%
- **Documentation**: ${metrics.documentationCoverage}%

## 🚀 Activity Summary

- **Commits Today**: ${metrics.commitsToday}
- **Commits This Week**: ${metrics.commitsThisWeek}
- **Active Days**: ${metrics.activeDays}
- **Contributors**: ${metrics.activeContributors}

## 📈 Insights

### Productivity
${insights.productivity}

### Quality
${insights.quality}

### Velocity
${insights.velocity}

## 🎯 Milestones

### ✅ Completed
${milestones.completed.map(m => `- ${m}`).join('\n') || '- None'}

### ⏳ Upcoming
${milestones.upcoming.map(m => `- ${m}`).join('\n') || '- None'}

### ⚠️ Overdue
${milestones.overdue.map(m => `- ${m}`).join('\n') || '- None'}

## 🔄 Recent Changes

${recentChanges.slice(0, 10).map(change => 
  `### ${this.formatChangeType(change.type)} - ${change.impact.toUpperCase()}
- **Description**: ${change.description}
- **Files**: ${change.filesChanged.length} files
- **Changes**: +${change.linesAdded}/-${change.linesRemoved} lines
- **Time**: ${change.timestamp.toLocaleString()}
- **Tags**: ${change.tags.join(', ')}`
).join('\n\n') || 'No recent changes'}

## 💡 Recommendations

${insights.recommendations.map(r => `- ${r}`).join('\n') || '- No recommendations at this time'}

---
*Generated by Project Progress Tracker*
`;
  }

  /**
   * ヘルパーメソッド群
   */
  private formatChangeType(type: ProgressChange['type']): string {
    const formatMap = {
      'task_completed': '✅ Task Completed',
      'feature_added': '🆕 Feature Added',
      'bug_fixed': '🐛 Bug Fixed',
      'refactoring': '♻️ Refactoring',
      'documentation': '📚 Documentation',
      'test_added': '🧪 Test Added'
    };
    return formatMap[type] || type;
  }

  private async getPackageInfo(): Promise<{ name?: string; version?: string }> {
    try {
      const packagePath = join(this.workingDir, 'package.json');
      const content = await fs.readFile(packagePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  private async collectGitStatistics(): Promise<{
    commitsToday: number;
    commitsThisWeek: number;
    activeDays: number;
    contributors: string[];
    activeContributors: number;
  }> {
    // 簡単な実装（実際のgit統計収集は複雑）
    return {
      commitsToday: 0,
      commitsThisWeek: 0,
      activeDays: 0,
      contributors: ['current-user'],
      activeContributors: 1
    };
  }

  private async collectFileStatistics(): Promise<{
    buildTime?: number;
    testTime?: number;
  }> {
    return {
      buildTime: 0,
      testTime: 0
    };
  }

  private async collectTaskProgress(): Promise<{ completed: number; total: number }> {
    // TODOコメント、GitHub Issues等から抽出
    return { completed: 8, total: 9 }; // 現在のtodo状況に基づく
  }

  private async calculateCodeQualityScore(): Promise<number> {
    // TypeScriptコンパイルエラー、ESLint警告等をチェック
    return 85; // サンプル値
  }

  private async calculateTestCoverage(): Promise<number> {
    // テストカバレッジレポートから取得
    return 75; // サンプル値
  }

  private async calculateDocumentationCoverage(): Promise<number> {
    // README、コメント密度等から計算
    return 80; // サンプル値
  }

  private async calculateLinesChanged(files: string[], type: 'added' | 'removed'): Promise<number> {
    // Git diffから計算（簡単な実装）
    return Math.floor(Math.random() * 100);
  }

  private async getCurrentAuthor(): Promise<string> {
    return 'current-user'; // Git configから取得
  }

  private generateTags(changes: { type: ProgressChange['type']; description: string }): string[] {
    const tags: string[] = [changes.type];
    
    // 説明文からタグを推測
    const description = changes.description.toLowerCase();
    if (description.includes('security')) tags.push('security');
    if (description.includes('performance')) tags.push('performance');
    if (description.includes('ui') || description.includes('ux')) tags.push('ui/ux');
    if (description.includes('api')) tags.push('api');
    if (description.includes('database')) tags.push('database');
    
    return tags;
  }

  private async getRecentChanges(): Promise<ProgressChange[]> {
    return this.progressHistory.slice(0, 50); // 直近50件
  }

  private async analyzeMilestones(): Promise<{
    completed: string[];
    upcoming: string[];
    overdue: string[];
  }> {
    return {
      completed: [
        'Setup wizard implementation',
        'ReadlineInterface lifecycle fix',
        'Constitutional AI Checker implementation'
      ],
      upcoming: [
        'Project Progress Tracker completion',
        'Integration testing',
        'Documentation finalization'
      ],
      overdue: []
    };
  }

  private async loadProgressHistory(): Promise<void> {
    try {
      const historyPath = join(this.workingDir, '.progress-history.json');
      const content = await fs.readFile(historyPath, 'utf-8');
      this.progressHistory = JSON.parse(content);
    } catch {
      this.progressHistory = [];
    }
  }

  private async saveProgressHistory(): Promise<void> {
    try {
      const historyPath = join(this.workingDir, '.progress-history.json');
      // 最新1000件のみ保持
      const recentHistory = this.progressHistory.slice(0, 1000);
      await fs.writeFile(historyPath, JSON.stringify(recentHistory, null, 2), 'utf-8');
    } catch (error) {
      console.warn('⚠️ Progress history保存エラー:', error);
    }
  }

  private getDefaultMetrics(): ProgressMetrics {
    return {
      projectName: 'Unknown Project',
      version: '0.0.0',
      lastUpdated: new Date(),
      completedTasks: 0,
      totalTasks: 0,
      completionPercentage: 0,
      codeQualityScore: 0,
      testCoverage: 0,
      documentationCoverage: 0,
      buildTime: 0,
      testExecutionTime: 0,
      deploymentTime: 0,
      commitsToday: 0,
      commitsThisWeek: 0,
      activeDays: 0,
      contributors: [],
      activeContributors: 0
    };
  }

  private createDefaultConfig(userConfig?: Partial<PPTConfig>): PPTConfig {
    const defaultConfig: PPTConfig = {
      enabled: true,
      trackingLevel: 'detailed',
      autoUpdateDocs: true,
      reportFormat: 'both',
      outputPath: 'docs/progress',
      gitIntegration: true,
      realtimeUpdates: false
    };

    return userConfig ? { ...defaultConfig, ...userConfig } : defaultConfig;
  }

  /**
   * 設定更新
   */
  updateConfig(newConfig: Partial<PPTConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 現在の設定取得
   */
  getConfig(): PPTConfig {
    return { ...this.config };
  }
}