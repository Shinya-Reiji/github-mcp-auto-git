#!/usr/bin/env node

/**
 * GitHub MCP Auto Git System - Refactored Main Entry Point
 * Modularized implementation following Constitutional AI principles
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { GitAutoMCP } from './core/git-auto-mcp.js';
import { CLICommandHandler, CommandResult } from './core/cli-command-handler.js';

// Load environment variables
config();

/**
 * Main application entry point
 * Fail Fast: Immediate error handling and validation
 * Be Lazy: Efficient command routing without redundant processing
 * TypeScript First: Complete type safety for main execution flow
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  // Create core system instance
  const gitAutoMCP = new GitAutoMCP();
  
  // Create CLI command handler
  const cliHandler = new CLICommandHandler(gitAutoMCP);
  
  // Setup graceful shutdown
  setupGracefulShutdown(gitAutoMCP);
  
  try {
    // Execute command
    const result: CommandResult = await cliHandler.executeCommand(args);
    
    // Handle command result
    if (!result.success) {
      console.error(`❌ コマンド実行失敗: ${result.message}`);
      process.exit(result.exitCode || 1);
    }
    
    // If watching mode, keep process alive
    if (args[0] === 'watch') {
      // Process will continue running until interrupted
      return;
    }
    
    // For other commands, exit with appropriate code
    process.exit(result.exitCode || 0);
    
  } catch (error) {
    console.error('❌ 予期しないエラーが発生しました:', error);
    
    // Attempt graceful cleanup
    try {
      await gitAutoMCP.stop();
    } catch (cleanupError) {
      console.error('❌ クリーンアップエラー:', cleanupError);
    }
    
    process.exit(1);
  }
}

/**
 * Setup graceful shutdown handlers
 * Fail Fast: Immediate cleanup on termination signals
 * Be Lazy: Efficient resource cleanup
 */
function setupGracefulShutdown(gitAutoMCP: GitAutoMCP): void {
  const handleShutdown = async (signal: string) => {
    console.log(`\n🛑 ${signal} シグナルを受信しました...`);
    
    try {
      await gitAutoMCP.stop();
      console.log('✅ 正常にシャットダウンしました');
      process.exit(0);
    } catch (error) {
      console.error('❌ シャットダウンエラー:', error);
      process.exit(1);
    }
  };

  // Handle various termination signals
  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGQUIT', () => handleShutdown('SIGQUIT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error('❌ 未処理例外:', error);
    try {
      await gitAutoMCP.stop();
    } catch (cleanupError) {
      console.error('❌ 例外後クリーンアップエラー:', cleanupError);
    }
    process.exit(1);
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('❌ 未処理Promise拒否:', reason);
    console.error('Promise:', promise);
    try {
      await gitAutoMCP.stop();
    } catch (cleanupError) {
      console.error('❌ 拒否後クリーンアップエラー:', cleanupError);
    }
    process.exit(1);
  });
}

/**
 * Check if this module is being run directly
 * TypeScript First: Type-safe module execution detection
 */
function isMainModule(): boolean {
  const currentFile = fileURLToPath(import.meta.url);
  return Boolean(process.argv[1] && 
    (currentFile === process.argv[1] || 
     currentFile.endsWith(process.argv[1]) ||
     process.argv[1].endsWith('github-auto-git'))); // Global install support
}

// Execute main function if this is the main module
if (isMainModule()) {
  main().catch(error => {
    console.error('❌ メイン実行エラー:', error);
    process.exit(1);
  });
}

// Export for programmatic usage
export { GitAutoMCP };
export default GitAutoMCP;