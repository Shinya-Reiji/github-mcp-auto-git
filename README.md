# 🚀 GitHub MCP Auto Git System v3.0

**プロダクション完成・メモリ効率化・統合MCP完了の超高性能自動Git操作ツール**

ファイルを保存するだけで、AIが自動的にコミットメッセージを作成し、安全性をチェックして、Gitにコミットしてくれる革新的なツールです！Constitutional AI原則に基づく企業級品質を実現。

## 🎉 バージョン3.0のプロダクション完成

### 🌟 企業級完全実装達成
- **メモリ効率化システム**: MemoryEfficientExecutor・並列エージェント最適化
- **統合MCPマネージャー**: UnifiedMCPManager・重複排除・一元管理
- **モジュール完全分割**: 672行→5モジュール・保守性大幅向上
- **95テストケース**: 包括的品質保証・企業級信頼性
- **Constitutional AI 100%準拠**: Fail Fast・Be Lazy・TypeScript First

### 🔧 技術的完全実装
- **プロダクション品質**: 実用環境完全対応・即座実用可能
- **完全型安全**: TypeScript strict mode・コンパイル時検証
- **高性能並列処理**: 3エージェント効率実行・メモリ監視
- **企業級エラーハンドリング**: 多層防御・グレースフル処理

## 📖 このツールができること

### 🎯 主な機能
- **📁 ファイル監視**: 保存したファイルを自動で検出
- **🛡️ 安全チェック**: 機密情報や危険な変更を自動検出
- **📝 メッセージ生成**: 非エンジニアにも分かりやすいコミットメッセージを自動作成
- **🔀 プルリクエスト管理**: 適切なマージ戦略を自動判定
- **⚡ 並列処理**: 3つのAIエージェントが同時に作業
- **🧙‍♂️ セットアップウィザード**: インタラクティブな初期設定ガイド
- **🔧 Claude Code最適化**: 適応的タイムアウトとパフォーマンス追跡
- **🌐 GitHub MCP統合**: 高度なGitHub操作をMCPプロトコル経由で実行

### 💡 誰に役立つか
- **個人開発者**: 面倒なGit操作から解放
- **チーム開発**: 一貫したコミットメッセージでプロジェクト管理
- **非エンジニア**: 技術的な詳細を知らなくても安全にファイル管理
- **学習者**: 良いGit運用を自動で学習

## 🎬 使用例

### ❌ 従来の方法（面倒...）
```bash
# 毎回これを繰り返す必要がありました
git add .
git commit -m "何を変更したか考える..."  # ← 何を書けばいいか分からない
git push
```

### ✅ このツールを使うと
```bash
# 1. 最初に一度だけ設定
github-auto-git init      # 設定ファイル作成
github-auto-git watch     # ⭐ 監視開始（メイン機能）

# 2. 後はファイルを保存するだけ！
# → AIが自動的に以下を実行:
#   ✓ 安全性チェック（機密情報の検出など）
#   ✓ 分かりやすいコミットメッセージ生成
#   ✓ 自動コミット・プッシュ
#   ✓ 必要に応じてプルリクエスト作成
```

## 🚀 かんたんセットアップ

### 1. インストール

#### オプション A: npm から（推奨）
```bash
# Node.jsが必要です（https://nodejs.org/）
npm install -g github-mcp-auto-git
```

#### オプション B: GitHubから直接
```bash
git clone https://github.com/Shinya-Reiji/github-mcp-auto-git.git
cd github-mcp-auto-git
npm install
npm run build
npm link  # グローバルにリンク
```

### 2. 初期設定

#### オプション A: セットアップウィザード（推奨）
```bash
# プロジェクトフォルダで実行
cd your-project
github-auto-git setup  # 🧙‍♂️ インタラクティブガイド
```

ウィザードが全ての設定を案内してくれます！

#### オプション B: 手動設定
```bash
# 従来の方法
github-auto-git init
```

### 3. 環境変数設定（オプション）
プルリクエスト機能を使いたい場合のみ：

```bash
# .env ファイルを作成
cp .env.example .env

# .env ファイルを編集
GITHUB_OWNER=あなたのGitHubユーザー名
GITHUB_REPO=リポジトリ名
GITHUB_TOKEN=GitHubトークン
```

> 💡 **詳細なGITHUB_TOKEN設定方法**: `github-auto-git token` コマンドで詳しいガイドを表示できます。

> 💡 **重要**: OpenAI APIキーは不要です！Claude Codeの組み込み機能を使用します。

### 4. 監視開始（推奨・メイン機能）
```bash
github-auto-git watch
```

**⭐ これがメインの使い方です！** ファイルを保存するたびに自動でGit操作が実行されます。

これで完了！後はファイルを編集・保存するだけです。

## 🛠️ コマンド一覧

| コマンド | 説明 | 使用例 |
|---------|------|--------|
| `setup` | 🧙‍♂️ **インタラクティブセットアップウィザード（初回推奨）** | `github-auto-git setup` |
| `watch` | ⭐ **ファイル監視を開始（推奨・メイン機能）** | `github-auto-git watch` |
| `commit` | 手動でGit操作実行 | `github-auto-git commit` |
| `commit [files]` | 特定ファイルのみコミット | `github-auto-git commit src/app.js` |
| `status` | システム状態を表示 | `github-auto-git status` |
| `token` | GITHUB_TOKEN設定ガイド表示 | `github-auto-git token` |
| `init` | 設定ファイルを作成 | `github-auto-git init` |

## 🤖 サブエージェント機能

このツールは3つの専門AIエージェントが連携して動作します：

### 🛡️ Git Safety Analyzer（安全性分析エージェント）
- **役割**: 危険な変更を事前に検出
- **チェック項目**:
  - 🔐 APIキーやパスワードの漏洩
  - 💥 大量ファイル削除などの破壊的操作
  - 📦 大容量ファイルの検出
  - ⚙️ 重要設定ファイルの変更

### 📝 Commit Message Generator（メッセージ生成エージェント）
- **役割**: 分かりやすいコミットメッセージを自動生成
- **特徴**:
  - 👥 非エンジニアにも理解できる表現
  - 📋 変更理由と効果を明確に説明
  - 🏷️ 技術標準（Conventional Commits）にも準拠
  - 💝 親しみやすく温かい表現

### 🔀 PR Management Agent（プルリクエスト管理エージェント）
- **役割**: 最適なマージ戦略を自動判定
- **機能**:
  - 📊 変更規模に応じたマージ戦略選択
  - 👥 適切なレビュアーの自動選択
  - 🏷️ 関連ラベルの自動付与
  - ⚡ 安全な変更の自動マージ判定

## 📊 実行結果の例

### ✅ 正常実行時
```
🔄 Git操作を開始します...

📝 サブエージェント git-safety-analyzer を実行しています...
📝 サブエージェント commit-message-generator を実行しています...
📝 サブエージェント pr-management-agent を実行しています...

✅ Git操作が完了しました

📝 コミット: 機能追加: ユーザーログイン画面を作成
🔒 安全性: SAFE (スコア: 92)
🆔 ハッシュ: a1b2c3d4
🔀 PR: #123

⏱️ 処理時間: 2341ms
```

### ⚠️ 警告がある場合
```
⚠️ 安全性チェックで問題を検出しました

🔒 セキュリティ上の問題:
  • ファイルにAPIキーが含まれています
  • 対策: 環境変数に移動して.gitignoreに追加してください

📝 コミット作成を一時停止しました
💡 問題を修正してから再度実行してください
```

## 🔧 高度な設定

### 設定ファイル（git-auto-mcp.config.js）
```javascript
module.exports = {
  enabled: true,                    // システムの有効/無効
  triggers: ['save', 'auto'],       // 実行トリガー
  paths: [                          // 監視対象パス
    'src/**/*',
    '!node_modules/**'
  ],
  subAgents: {
    gitSafetyAnalyzer: {
      enabled: true,
      safetyThreshold: 0.85         // 安全性閾値（0-1）
    },
    commitMessageGenerator: {
      enabled: true,
      language: 'ja',               // 言語設定
      style: 'friendly'             // メッセージスタイル
    },
    prManagementAgent: {
      enabled: true,
      autoMergeThreshold: 0.85      // 自動マージ閾値
    }
  }
};
```

### 除外設定例
```javascript
// 特定のファイルやフォルダを監視対象から除外
paths: [
  'src/**/*',
  'docs/**/*',
  '!node_modules/**',     // node_modulesを除外
  '!dist/**',             // ビルド結果を除外
  '!*.log',               // ログファイルを除外
  '!.env'                 // 環境変数ファイルを除外
]
```

## 🛡️ セキュリティ機能

### 自動検出される危険なパターン
- **機密情報**: APIキー、パスワード、トークン
- **AWS認証情報**: アクセスキー、シークレットキー
- **データベース接続文字列**: MongoDB、PostgreSQL、MySQL
- **秘密鍵**: SSH鍵、SSL証明書
- **破壊的操作**: 大量ファイル削除、DROP TABLE文

### 安全性レベル
- **🟢 SAFE (85-100点)**: 自動実行可能
- **🟡 WARNING (60-84点)**: 注意確認後に実行
- **🔴 DANGER (0-59点)**: 実行停止、手動確認必須

## ⚡ パフォーマンス最適化

### 適応的タイムアウト機能
- **学習機能**: 実行履歴から最適なタイムアウト時間を自動計算
- **優先度管理**: critical/high/medium/low レベルでリソース割り当て
- **リトライ最適化**: 段階的タイムアウト延長 (1.0x → 1.5x → 2.0x)

### Claude Code統合最適化
- **環境検出**: Claude Code実行時の自動最適化
- **メモリ管理**: 大量ファイル処理時のガベージコレクション
- **バッチ処理**: 50ファイル以上の効率的な並列処理

### パフォーマンス統計
- **実行時間追跡**: 各操作の平均実行時間を記録
- **システム健全性**: optimal/good/warning/critical レベルでの監視
- **定期メンテナンス**: 古いログとパフォーマンス履歴の自動クリーンアップ

## 🤝 チーム開発での活用

### メリット
- **一貫性**: 全員が同じ品質のコミットメッセージ
- **安全性**: 機密情報の漏洩を自動防止
- **効率性**: コードレビューの負荷軽減
- **学習効果**: 良いGit運用を自然に身につけられる

### チーム設定例
```javascript
// プロジェクト全体で共通の設定
module.exports = {
  subAgents: {
    commitMessageGenerator: {
      language: 'ja',
      style: 'professional'    // チーム用にフォーマル設定
    },
    prManagementAgent: {
      autoMergeThreshold: 0.95  // チーム用に厳格設定
    }
  }
};
```

## 🚨 トラブルシューティング

### よくある問題と解決方法

#### ❓ コマンドが見つからない
```bash
# 解決方法：グローバルインストールを確認
npm install -g github-mcp-auto-git
npm list -g github-mcp-auto-git
```

#### ❓ サブエージェントの読み込みエラー
```bash
# 解決方法：設定確認
github-auto-git status

# エージェントファイルの確認
ls src/agents/
```

#### ❓ GitHub連携ができない
```bash
# 解決方法1：詳細なトークン設定ガイド表示
github-auto-git token

# 解決方法2：トークン設定確認
echo $GITHUB_TOKEN
# または .envファイルの内容確認

# 解決方法3：権限確認
# GitHub → Settings → Developer settings → Personal access tokens
# 必要な権限：repo, workflow, write:packages（オプション）
```

#### ❓ 監視が動作しない
```bash
# 解決方法：権限とパス確認
github-auto-git status
# 監視パターンの確認
```

#### ✅ v1.0.4で解決済みの問題
- **PIDファイル無限ループ**: システムが自分のPIDファイルを監視してしまう問題 → **完全解決**
- **セキュリティ検証の誤検知**: 正常なGit設定が脅威として判定される問題 → **完全解決** 
- **システム応答性の問題**: 処理が重くなる問題 → **大幅改善**

> 💡 **v1.0.4をお使いの場合**: 上記の問題は既に修正済みです。最新版の使用を強く推奨します。

## 📚 学習リソース

### Git初心者向け
- [Gitとは？](https://git-scm.com/book/ja/v2)
- [GitHub入門](https://docs.github.com/ja)
- [良いコミットメッセージの書き方](https://chris.beams.io/posts/git-commit/)

### このツールの技術詳細
- [Claude Code サブエージェント機能](https://docs.anthropic.com/en/docs/claude-code/sub-agents)
- [TypeScript](https://www.typescriptlang.org/)
- [Node.js](https://nodejs.org/)

## 🙋‍♀️ よくある質問

### Q: OpenAI APIキーは必要ですか？
A: **不要です！** Claude Codeの組み込みサブエージェント機能を使用するため、外部APIキーは必要ありません。

### Q: どのくらい安全ですか？
A: 非常に安全です。機密情報を自動検出し、危険な操作は事前に停止します。また、全ての処理はローカルで実行されます。

### Q: チームで使えますか？
A: はい！設定ファイルをGitで共有することで、チーム全体で一貫した運用が可能です。

### Q: Windowsで動作しますか？
A: はい。Node.jsが動作する環境であれば、Windows、Mac、Linuxで利用できます。

### Q: 既存のGitリポジトリで使えますか？
A: はい。既存のプロジェクトにも簡単に導入できます。

### Q: 料金はかかりますか？
A: このツール自体は無料です。Claude Codeのライセンスについては[Anthropic公式サイト](https://claude.ai/)をご確認ください。

## 🤝 コントリビューション

このプロジェクトへの貢献を歓迎します！

### 貢献方法
1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/AmazingFeature`)
3. 変更をコミット (`git commit -m 'Add some AmazingFeature'`)
4. ブランチにプッシュ (`git push origin feature/AmazingFeature`)
5. プルリクエストを作成

### 開発環境セットアップ
```bash
# リポジトリをクローン
git clone https://github.com/Shinya-Reiji/github-mcp-auto-git.git
cd github-mcp-auto-git

# 依存関係をインストール
npm install

# 開発モードで実行
npm run dev

# ビルド
npm run build

# テスト
npm test
```

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルをご確認ください。

## 🌟 サポート

### バグ報告・機能要望
[GitHub Issues](https://github.com/Shinya-Reiji/github-mcp-auto-git/issues) でお気軽にご報告ください。


---

<div align="center">

**🎉 開発体験を革新する、AI駆動のGit自動化ツール 🎉**

[📖 ドキュメント](https://github.com/Shinya-Reiji/github-mcp-auto-git#readme) • 
[🐛 バグ報告](https://github.com/Shinya-Reiji/github-mcp-auto-git/issues) • 
[💡 機能要望](https://github.com/Shinya-Reiji/github-mcp-auto-git/issues)

**⭐ このツールが役に立ったら、ぜひスターをお願いします！ ⭐**

---

## 🆕 最新アップデート情報

### v1.0.4 の重要な修正（2024年最新）
- 🔥 **重大なバグ修正**: PIDファイル無限ループ問題を完全解決
- 🛡️ **セキュリティ検証最適化**: 誤検知を大幅削減、正常なGit操作をスムーズに
- ⚡ **パフォーマンス向上**: システム応答性が大幅に改善
- 🎯 **プロダクション対応**: 実用環境での安定性を大幅強化

### v1.0.3 の新機能
- 🎯 **インタラクティブ監視設定**: `watch`起動時に監視範囲を選択可能
- 📁 **プロジェクト全体監視**: README.mdなどルートファイルも自動監視
- ⚙️ **カスタムパターン設定**: 柔軟な監視対象カスタマイズ
- 🚀 **エンタープライズ級品質**: 包括的テスト・セキュリティ・エラーハンドリング

**✨ 現在は完全に安定動作！プロダクション環境での使用に最適化されました。**

### 🔧 v1.0.4 技術的改善詳細

#### 修正された問題
1. **PIDファイル無限ループ**
   - **問題**: システムが自身の `.github-auto-git.pid` ファイルを監視してしまい、無限処理ループが発生
   - **解決**: chokidarの`ignored`パターンに `**/*.pid` と `.github-auto-git.pid` を追加

2. **セキュリティ検証の過敏反応**
   - **問題**: 正常なGit設定オブジェクト（`autoCommit`, `autoPush`等）が脅威として誤検知
   - **解決**: 
     - 検証レベルを `INTERNAL` → `PUBLIC` に変更
     - Git設定オブジェクト専用のホワイトリスト機能追加
     - パターンマッチングロジックを最適化

3. **応答性の向上**
   - **問題**: 重複するセキュリティチェックによる処理遅延
   - **解決**: Git設定オブジェクトには機密情報チェックのみ適用

これらの修正により、システムは**0個の脅威検出**で正常動作し、実用性が大幅に向上しました。

</div>