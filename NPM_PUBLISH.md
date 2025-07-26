# 📦 npm パッケージ公開手順

## 1. npm アカウント作成・ログイン

### 1.1 npmアカウント作成
1. [npmjs.com](https://www.npmjs.com/) にアクセス
2. 「Sign Up」をクリックしてアカウント作成
3. メール認証を完了

### 1.2 ローカルでログイン
```bash
npm adduser
# または
npm login
```

ブラウザが開くので、npmアカウントでログインしてください。

### 1.3 ログイン確認
```bash
npm whoami
# 結果: あなたのnpmユーザー名が表示される
```

## 2. パッケージ名の確認・変更

### 2.1 パッケージ名の重複確認
```bash
npm view github-mcp-auto-git
# 結果: 404エラーなら使用可能、既存の場合は名前変更が必要
```

### 2.2 必要に応じてパッケージ名変更
もしパッケージ名が重複している場合、`package.json`の`name`を変更：

```json
{
  "name": "@your-username/github-mcp-auto-git",
  // または
  "name": "claude-git-auto-mcp",
  // または
  "name": "github-mcp-auto-git-cli"
}
```

## 3. パッケージ公開前の確認

### 3.1 package.json の必須フィールド確認
```json
{
  "name": "github-mcp-auto-git",
  "version": "1.0.0",
  "description": "Claude Codeサブエージェント機能を活用した自動Git操作システム",
  "main": "dist/index.js",
  "bin": {
    "github-auto-git": "dist/index.js"
  },
  "files": [
    "dist/**/*",
    "src/agents/**/*",
    "README.md",
    "LICENSE"
  ],
  "repository": "...",
  "bugs": "...",
  "homepage": "..."
}
```

### 3.2 ビルド確認
```bash
npm run build
```

### 3.3 パッケージ内容確認
```bash
npm pack --dry-run
```

## 4. npm パッケージ公開

### 4.1 初回公開
```bash
npm publish
```

### 4.2 公開確認
```bash
npm view github-mcp-auto-git
```

### 4.3 インストールテスト
```bash
# 別のディレクトリで
npm install -g github-mcp-auto-git
github-auto-git --help
```

## 5. 公開後のREADME更新

README.mdのインストール方法を実際のパッケージ名に更新：

```markdown
### 1. インストール
\`\`\`bash
# Node.jsが必要です（https://nodejs.org/）
npm install -g github-mcp-auto-git
\`\`\`
```

## 6. バージョン管理

### 6.1 パッチ更新（バグ修正）
```bash
npm version patch  # 1.0.0 → 1.0.1
npm publish
```

### 6.2 マイナー更新（新機能追加）
```bash
npm version minor  # 1.0.0 → 1.1.0
npm publish
```

### 6.3 メジャー更新（破壊的変更）
```bash
npm version major  # 1.0.0 → 2.0.0
npm publish
```

## 7. パッケージ統計の確認

### 7.1 ダウンロード統計
- [npm stat](https://npm-stat.com/charts.html?package=github-mcp-auto-git)
- [npmjs.com](https://www.npmjs.com/package/github-mcp-auto-git)

### 7.2 依存関係チェック
```bash
npm audit
npm update
```

## 8. トラブルシューティング

### ❓ パッケージ名が重複している
```bash
# スコープ付きパッケージとして公開
npm publish --access public
```

### ❓ 公開権限エラー
```bash
# 2FA（二要素認証）が必要な場合
npm publish --otp=123456
```

### ❓ ファイルが含まれていない
`package.json`の`files`フィールドを確認し、必要なファイルを追加。

### ❓ CLIコマンドが動作しない
- `bin`フィールドの設定確認
- shebang（`#!/usr/bin/env node`）の設定確認
- ファイルの実行権限確認

## 9. 完了チェックリスト

- [ ] npmアカウント作成・ログイン完了
- [ ] パッケージ名の重複確認完了
- [ ] package.json必須フィールド設定完了
- [ ] ビルド成功確認
- [ ] npm publish実行完了
- [ ] インストールテスト成功
- [ ] README.mdインストール方法更新
- [ ] GitHubリポジトリにタグ作成（`git tag v1.0.0 && git push --tags`）

## 🎉 公開完了後

公開が完了すると、世界中の開発者が以下のコマンドでツールを使えるようになります：

```bash
npm install -g github-mcp-auto-git
github-auto-git init
github-auto-git watch
```

**パッケージページ**: https://www.npmjs.com/package/github-mcp-auto-git