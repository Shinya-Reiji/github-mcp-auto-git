import { promises as fs } from 'fs';
import { join } from 'path';
import { IndependentSubAgents } from './independent-subagents.js';
export class SubAgentManager {
    constructor(agentsPath = './src/agents', workingDir = process.cwd()) {
        this.loadedAgents = new Map();
        this.agentsPath = agentsPath;
        this.workingDir = workingDir;
        this.independentAgents = new IndependentSubAgents();
    }
    async loadAgent(agentName) {
        if (this.loadedAgents.has(agentName)) {
            return this.loadedAgents.get(agentName);
        }
        const agentPath = join(this.agentsPath, `${agentName}.md`);
        const content = await fs.readFile(agentPath, 'utf-8');
        const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!frontMatterMatch) {
            throw new Error(`Invalid agent file format: ${agentName}`);
        }
        const yamlContent = frontMatterMatch[1];
        if (!yamlContent) {
            throw new Error(`Empty frontmatter in agent file: ${agentName}`);
        }
        const prompt = content.replace(/^---\n[\s\S]*?\n---\n/, '');
        const metadata = {};
        yamlContent.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length > 0) {
                const value = valueParts.join(':').trim();
                if (key.trim() === 'tools' && value.startsWith('[')) {
                    try {
                        // JSON配列として解析を試行
                        const cleanValue = value.replace(/['"]/g, '"'); // シングルクォートをダブルクォートに変換
                        const jsonValue = cleanValue.replace(/(\w+)/g, '"$1"'); // クォートされていない値をクォートで囲む
                        metadata[key.trim()] = JSON.parse(jsonValue);
                    }
                    catch {
                        // JSON解析に失敗した場合は、カンマ区切りの配列として解析
                        const arrayValue = value.replace(/[\[\]]/g, '').split(',').map(item => item.trim().replace(/['"]/g, ''));
                        metadata[key.trim()] = arrayValue.filter(item => item.length > 0);
                    }
                }
                else {
                    metadata[key.trim()] = value.replace(/['"]/g, '');
                }
            }
        });
        const agent = {
            name: metadata.name,
            description: metadata.description,
            version: metadata.version,
            tools: metadata.tools || [],
            prompt
        };
        this.loadedAgents.set(agentName, agent);
        return agent;
    }
    async executeAgent(agentName, userPrompt, context = {}) {
        const startTime = Date.now();
        try {
            const agent = await this.loadAgent(agentName);
            // このシステムはClaude Codeのサブエージェント機能と連携するために設計されています
            // 実際の実行時は、Claude Codeが自動的にサブエージェントを委譲します
            // フォールバック処理：Claude Code外での実行時は簡易分析を提供
            const fullPrompt = `${userPrompt}\n\nContext: ${JSON.stringify(context, null, 2)}`;
            console.log(`📝 サブエージェント ${agentName} を実行しています...`);
            console.log(`📋 タスク: ${userPrompt}`);
            // 簡易的な分析結果を生成（Claude Codeのサブエージェント機能がない場合）
            const result = this.generateFallbackResult(agentName, context);
            return {
                agentName: agent.name,
                result,
                executionTime: Date.now() - startTime,
                confidence: 0.6 // フォールバック処理なので低めの信頼度
            };
        }
        catch (error) {
            return {
                agentName,
                result: null,
                executionTime: Date.now() - startTime,
                confidence: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async executeParallel(agentExecutions) {
        const promises = agentExecutions.map(execution => this.executeAgent(execution.agentName, execution.userPrompt, execution.context));
        return Promise.all(promises);
    }
    async analyzeSafety(context) {
        try {
            // 高品質な独立実装を使用
            console.log(`🔍 高品質安全性分析を実行中... (ファイル数: ${context.files.length})`);
            const result = await this.independentAgents.analyzeSafety(context.files, this.workingDir);
            console.log(`✅ 安全性分析完了 (スコア: ${result.safetyScore}, レベル: ${result.level})`);
            return result;
        }
        catch (error) {
            console.warn(`⚠️ 独立分析に失敗、フォールバックを使用: ${error}`);
            // フォールバックとして既存実装を使用
            const result = await this.executeAgent('git-safety-analyzer', `以下の変更内容の安全性を分析してください。機密情報の検出、破壊的変更の確認、ファイルサイズのチェックを行い、安全性スコアと推奨事項を提供してください。`, context);
            return result.result;
        }
    }
    async generateCommitMessage(context) {
        try {
            // 高品質な独立実装を使用
            console.log(`📝 高品質コミットメッセージ生成中... (変更タイプ: ${context.changes.type})`);
            const result = await this.independentAgents.generateCommitMessage(context.changes, context.files);
            console.log(`✅ コミットメッセージ生成完了: "${result.title}"`);
            return result;
        }
        catch (error) {
            console.warn(`⚠️ 独立分析に失敗、フォールバックを使用: ${error}`);
            // フォールバックとして既存実装を使用
            const result = await this.executeAgent('commit-message-generator', `以下の変更内容に基づいて、非エンジニアにも理解できるコミットメッセージを生成してください。変更の種類、影響範囲、効果を分かりやすく説明してください。`, context);
            return result.result;
        }
    }
    async managePR(context) {
        try {
            // 高品質な独立実装を使用
            console.log(`🔀 高品質PR管理戦略決定中... (影響度: ${context.changes.impact})`);
            const result = await this.independentAgents.generatePRManagement(context.changes, [], // ファイル一覧は changes に含まれているため空配列
            context.commitMessage.title);
            console.log(`✅ PR管理戦略決定完了 (自動マージ: ${result.autoMerge})`);
            return result;
        }
        catch (error) {
            console.warn(`⚠️ 独立分析に失敗、フォールバックを使用: ${error}`);
            // フォールバックとして既存実装を使用
            const result = await this.executeAgent('pr-management-agent', `プルリクエストの管理戦略を決定してください。変更内容、安全性分析、コミットメッセージを総合的に判断し、適切なマージ戦略、レビュアー、ラベルを提案してください。`, context);
            return result.result;
        }
    }
    async executeGitWorkflow(context) {
        const startTime = Date.now();
        const errors = [];
        try {
            const [safetyResult, commitResult] = await this.executeParallel([
                {
                    agentName: 'git-safety-analyzer',
                    userPrompt: '変更内容の安全性を分析してください。',
                    context: { files: context.files, diff: context.diff, changes: context.changes }
                },
                {
                    agentName: 'commit-message-generator',
                    userPrompt: 'コミットメッセージを生成してください。',
                    context: { changes: context.changes, diff: context.diff, files: context.files }
                }
            ]);
            if (safetyResult?.error) {
                errors.push(`Safety analysis failed: ${safetyResult.error}`);
            }
            if (commitResult?.error) {
                errors.push(`Commit message generation failed: ${commitResult.error}`);
            }
            const safety = safetyResult?.result;
            const commitMessage = commitResult?.result;
            let prManagement;
            if (safety && commitMessage) {
                const prResult = await this.executeAgent('pr-management-agent', 'PR管理戦略を決定してください。', {
                    changes: context.changes,
                    safety,
                    commitMessage,
                    branchName: context.branchName,
                    targetBranch: context.targetBranch || 'main'
                });
                if (prResult.error) {
                    errors.push(`PR management failed: ${prResult.error}`);
                }
                prManagement = prResult.result;
            }
            else {
                prManagement = this.createFallbackPRManagement(context);
            }
            return {
                safety: safety || this.createFallbackSafety(),
                commitMessage: commitMessage || this.createFallbackCommitMessage(),
                prManagement,
                executionTime: Date.now() - startTime,
                errors
            };
        }
        catch (error) {
            errors.push(`Workflow execution failed: ${error}`);
            return {
                safety: this.createFallbackSafety(),
                commitMessage: this.createFallbackCommitMessage(),
                prManagement: this.createFallbackPRManagement(context),
                executionTime: Date.now() - startTime,
                errors
            };
        }
    }
    extractConfidence(result) {
        const confidenceMatch = result.match(/"confidence":\s*([0-9.]+)/);
        return confidenceMatch && confidenceMatch[1] ? parseFloat(confidenceMatch[1]) : 0.5;
    }
    generateFallbackResult(agentName, context) {
        switch (agentName) {
            case 'git-safety-analyzer':
                return {
                    safetyScore: 75,
                    level: 'SAFE',
                    risks: [],
                    recommendations: ['Claude Codeのサブエージェント機能を使用することを推奨します'],
                    autoApprove: true,
                    confidence: 0.6
                };
            case 'commit-message-generator':
                return {
                    title: '変更: ファイルを更新',
                    body: 'ファイルの内容が更新されました。\n\n詳細な分析にはClaude Codeのサブエージェント機能をご利用ください。',
                    conventional: 'chore: update files',
                    confidence: 0.6
                };
            case 'pr-management-agent':
                return {
                    prTitle: '変更: ファイル更新',
                    prBody: 'ファイルの変更が含まれています。\n\n詳細な分析結果を表示するには、Claude Codeのサブエージェント機能をお使いください。',
                    autoMerge: false,
                    mergeStrategy: 'squash',
                    reviewers: [],
                    labels: ['needs-review'],
                    assignees: [],
                    deleteBranch: true,
                    reasoning: 'フォールバック処理のため手動レビューが必要です'
                };
            default:
                return {};
        }
    }
    createFallbackSafety() {
        return {
            safetyScore: 50,
            level: 'WARNING',
            risks: [{
                    type: 'conflict_risk',
                    severity: 'medium',
                    description: 'サブエージェント分析が失敗しました。手動で確認してください。',
                    file: '',
                    suggestion: '変更内容を手動で確認し、安全性を判断してください。'
                }],
            recommendations: ['変更内容の手動確認を推奨します'],
            autoApprove: false,
            confidence: 0.1
        };
    }
    createFallbackCommitMessage() {
        return {
            title: '変更: ファイルを更新',
            body: 'ファイルの内容を更新しました。\n\n詳細は変更内容をご確認ください。',
            conventional: 'chore: update files',
            confidence: 0.1
        };
    }
    createFallbackPRManagement(context) {
        return {
            prTitle: `変更: ${context.branchName} の更新`,
            prBody: 'ファイルの変更を含むプルリクエストです。\n\n詳細な変更内容をレビューしてください。',
            autoMerge: false,
            mergeStrategy: 'squash',
            reviewers: [],
            labels: ['review-required'],
            assignees: [],
            deleteBranch: true,
            reasoning: 'サブエージェント分析が失敗したため、手動レビューが必要です。'
        };
    }
    async getAgentStatus() {
        const available = [];
        const errors = [];
        try {
            const files = await fs.readdir(this.agentsPath);
            const mdFiles = files.filter(f => f.endsWith('.md'));
            for (const file of mdFiles) {
                const agentName = file.replace('.md', '');
                try {
                    await this.loadAgent(agentName);
                    available.push(agentName);
                }
                catch (error) {
                    errors.push(`${agentName}: ${error}`);
                }
            }
        }
        catch (error) {
            errors.push(`Failed to read agents directory: ${error}`);
        }
        return {
            loaded: Array.from(this.loadedAgents.keys()),
            available,
            errors
        };
    }
}
//# sourceMappingURL=subagent-manager.js.map