# GitHub リポジトリ公開手順

## 1. GitHubでリポジトリを作成

1. [GitHub](https://github.com) にアクセス
2. 右上の「+」をクリック → 「New repository」
3. 以下の設定で作成：
   - Repository name: `github-mcp-auto-git`
   - Description: `🚀 Claude Code サブエージェント機能を活用した自動Git操作ツール`
   - Visibility: **Public** ✅
   - ✅ Add a README file: **チェックしない**（既にあるため）
   - ✅ Add .gitignore: **チェックしない**（既にあるため）
   - ✅ Choose a license: **チェックしない**（既にあるため）

## 2. ローカルリポジトリをGitHubにプッシュ

```bash
# リモートリポジトリを追加
git remote add origin https://github.com/shinya_reiji/github-mcp-auto-git.git

# メインブランチの設定
git branch -M main

# 初回プッシュ
git push -u origin main
```

## 3. リポジトリ設定の最適化

### 3.1 About セクションの設定
GitHubリポジトリページで「⚙️ Settings」→「General」→「About」：

- **Description**: `🚀 Claude Code サブエージェント機能を活用した自動Git操作ツール`
- **Website**: （あれば）
- **Topics（タグ）**: 
  - `claude-code`
  - `subagent`
  - `git-automation`
  - `ai-tools`
  - `typescript`
  - `developer-tools`
  - `github-integration`

### 3.2 GitHub Pagesの設定（オプション）
「Settings」→「Pages」で、ドキュメントサイトを作成できます。

### 3.3 Issues & Discussions の有効化
「Settings」→「General」→「Features」：
- ✅ Issues
- ✅ Discussions （コミュニティ機能）

## 4. npmパッケージとして公開（オプション）

```bash
# npmにログイン
npm login

# パッケージ公開
npm publish

# 公開確認
npm view github-mcp-auto-git
```

## 5. 公開後のリンク

公開されたリポジトリのURL:
**https://github.com/shinya_reiji/github-mcp-auto-git**

README.mdの中のリンクを実際のリポジトリURLに更新してください：

```markdown
# 変更前（例）
[GitHub Issues](https://github.com/your-username/github-mcp-auto-git/issues)

# 変更後
[GitHub Issues](https://github.com/shinya_reiji/github-mcp-auto-git/issues)
```

## 6. 完成チェックリスト

- [ ] GitHubリポジトリ作成完了
- [ ] ローカルコードのプッシュ完了
- [ ] README.mdの表示確認
- [ ] About セクション設定完了
- [ ] Topics（タグ）設定完了
- [ ] Issues機能有効化
- [ ] npmパッケージ公開（オプション）
- [ ] ドキュメント内のURLリンク更新

## 7. プロモーション（オプション）

公開後、以下でプロジェクトを宣伝できます：
- [Product Hunt](https://www.producthunt.com/)
- [Dev.to](https://dev.to/)
- [Qiita](https://qiita.com/)
- [Zenn](https://zenn.dev/)
- Twitter/X でハッシュタグ `#ClaudeCode` `#AI開発ツール`

---

**🎉 これで世界中の開発者があなたのツールを使えるようになります！**