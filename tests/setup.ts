// Jest セットアップファイル
import { jest } from '@jest/globals';

// モック関数のグローバル設定
global.console = {
  ...console,
  // テスト中のコンソール出力を制御
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// 環境変数のモック
process.env.NODE_ENV = 'test';
process.env.GITHUB_OWNER = 'test-owner';
process.env.GITHUB_REPO = 'test-repo';
process.env.GITHUB_TOKEN = 'test-token';

// テストタイムアウト設定
jest.setTimeout(30000);

// 非同期操作のクリーンアップ
afterEach(() => {
  jest.clearAllMocks();
});