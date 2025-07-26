import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ErrorRecoverySystem, ErrorLevel, ErrorCategory } from '../../src/core/error-recovery';

describe('ErrorRecoverySystem', () => {
  let errorRecovery: ErrorRecoverySystem;

  beforeEach(() => {
    errorRecovery = new ErrorRecoverySystem();
    jest.clearAllMocks();
  });

  describe('error categorization', () => {
    it('should categorize network errors correctly', async () => {
      const networkError = new Error('ENOTFOUND github.com');
      
      try {
        await errorRecovery.handleError(
          networkError,
          {
            operation: 'test-network',
            timestamp: new Date(),
            workingDir: '/test',
            attempt: 1
          }
        );
      } catch (error) {
        // Expected to throw, we just want to test categorization
      }

      const stats = errorRecovery.getErrorStatistics();
      expect(stats.byCategory.network).toBe(1);
    });

    it('should categorize GitHub API errors correctly', async () => {
      const githubError = new Error('GitHub API rate limit exceeded');
      
      try {
        await errorRecovery.handleError(
          githubError,
          {
            operation: 'test-github',
            timestamp: new Date(),
            workingDir: '/test',
            attempt: 1
          }
        );
      } catch (error) {
        // Expected to throw or recover
      }

      const stats = errorRecovery.getErrorStatistics();
      expect(stats.byCategory.github_api).toBe(1);
    });

    it('should categorize Git operation errors correctly', async () => {
      const gitError = new Error('git commit failed - no changes');
      
      try {
        await errorRecovery.handleError(
          gitError,
          {
            operation: 'test-git',
            timestamp: new Date(),
            workingDir: '/test',
            attempt: 1
          }
        );
      } catch (error) {
        // Expected to throw or recover
      }

      const stats = errorRecovery.getErrorStatistics();
      expect(stats.byCategory.git_operation).toBe(1);
    });
  });

  describe('error level determination', () => {
    it('should classify security errors as critical', async () => {
      const securityError = new Error('Secret detected in commit');
      
      try {
        await errorRecovery.handleError(
          securityError,
          {
            operation: 'test-security',
            timestamp: new Date(),
            workingDir: '/test',
            attempt: 1
          }
        );
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('CRITICAL ERROR');
      }

      const stats = errorRecovery.getErrorStatistics();
      expect(stats.byLevel.critical).toBe(1);
    });

    it('should handle retryable errors with fallback', async () => {
      const retryableError = new Error('network timeout');
      let fallbackCalled = false;
      
      const result = await errorRecovery.handleError(
        retryableError,
        {
          operation: 'test-retry',
          timestamp: new Date(),
          workingDir: '/test',
          attempt: 1
        },
        async () => {
          fallbackCalled = true;
          return 'fallback-result';
        }
      );

      expect(result).toBe('fallback-result');
      expect(fallbackCalled).toBe(true);
    });
  });

  describe('system health monitoring', () => {
    it('should report healthy status with no errors', () => {
      const health = errorRecovery.checkSystemHealth();
      
      expect(health.status).toBe('healthy');
      expect(health.message).toContain('正常に動作');
      expect(health.recommendations).toHaveLength(0);
    });

    it('should report warning status with multiple unresolved errors', async () => {
      // Create multiple unresolved errors
      for (let i = 0; i < 6; i++) {
        try {
          await errorRecovery.handleError(
            new Error(`Test error ${i}`),
            {
              operation: `test-${i}`,
              timestamp: new Date(),
              workingDir: '/test',
              attempt: 1
            }
          );
        } catch (error) {
          // Some may throw, some may not
        }
      }

      const health = errorRecovery.checkSystemHealth();
      expect(health.status).toBe('warning');
      expect(health.recommendations.length).toBeGreaterThan(0);
    });

    it('should report critical status with critical errors', async () => {
      try {
        await errorRecovery.handleError(
          new Error('credential leaked'),
          {
            operation: 'test-critical',
            timestamp: new Date(),
            workingDir: '/test',
            attempt: 1
          }
        );
      } catch (error) {
        // Expected to throw
      }

      const health = errorRecovery.checkSystemHealth();
      expect(health.status).toBe('critical');
      expect(health.recommendations).toContain('システム管理者に即座に連絡してください');
    });
  });

  describe('error statistics', () => {
    it('should track error statistics correctly', async () => {
      const errors = [
        new Error('network error'),
        new Error('github api error'),
        new Error('file system error')
      ];

      for (let i = 0; i < errors.length; i++) {
        try {
          await errorRecovery.handleError(
            errors[i]!,
            {
              operation: `test-${i}`,
              timestamp: new Date(),
              workingDir: '/test',
              attempt: 1
            },
            async () => `recovered-${i}`
          );
        } catch (error) {
          // Some may throw
        }
      }

      const stats = errorRecovery.getErrorStatistics();
      
      expect(stats.total).toBe(3);
      expect(stats.resolvedCount).toBeGreaterThan(0);
      expect(stats.avgResolutionTime).toBeGreaterThan(0);
    });
  });

  describe('error log cleanup', () => {
    it('should clear old errors', async () => {
      // Create some errors
      for (let i = 0; i < 3; i++) {
        try {
          await errorRecovery.handleError(
            new Error(`Old error ${i}`),
            {
              operation: `test-old-${i}`,
              timestamp: new Date(Date.now() - 25 * 3600000), // 25 hours ago
              workingDir: '/test',
              attempt: 1
            }
          );
        } catch (error) {
          // May throw
        }
      }

      const initialStats = errorRecovery.getErrorStatistics();
      const clearedCount = errorRecovery.clearOldErrors(24); // Clear older than 24 hours
      const finalStats = errorRecovery.getErrorStatistics();

      expect(clearedCount).toBeGreaterThan(0);
      expect(finalStats.total).toBeLessThan(initialStats.total);
    });
  });

  describe('retry mechanism', () => {
    it('should implement exponential backoff', async () => {
      let attempts = 0;
      const failingOperation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Still failing');
        }
        return 'success';
      };

      const result = await errorRecovery.handleError(
        new Error('Initial failure'),
        {
          operation: 'test-retry-backoff',
          timestamp: new Date(),
          workingDir: '/test',
          attempt: 1
        },
        failingOperation
      );

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });
  });
});