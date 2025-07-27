/**
 * Memory Efficient Executor - Optimized parallel agent execution
 * Implements Constitutional AI principles for efficient resource management
 */

import EventEmitter from 'events';

export interface ExecutionTask<T = any> {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  timeout: number;
  retryAttempts: number;
  memoryLimit: number; // in MB
  executor: () => Promise<T>;
  cleanup?: () => Promise<void>;
}

export interface ExecutionResult<T = any> {
  taskId: string;
  success: boolean;
  result?: T;
  error?: string;
  executionTime: number;
  memoryUsed: number;
  retryCount: number;
}

export interface MemoryStats {
  totalAllocated: number;
  currentUsage: number;
  peakUsage: number;
  tasksActive: number;
  tasksQueued: number;
  gcCollections: number;
}

export interface ExecutorConfig {
  maxConcurrentTasks: number;
  memoryThreshold: number; // in MB
  gcThreshold: number; // trigger GC when usage exceeds this percentage
  priorityQueues: boolean;
  adaptiveTimeout: boolean;
  memoryMonitoring: boolean;
}

export class MemoryEfficientExecutor extends EventEmitter {
  private config: ExecutorConfig;
  private activeTasks = new Map<string, ExecutionTask>();
  private taskQueues = new Map<string, ExecutionTask[]>();
  private memoryStats: MemoryStats;
  private gcTimer?: NodeJS.Timeout;
  private monitoringTimer?: NodeJS.Timeout;

  constructor(config: Partial<ExecutorConfig> = {}) {
    super();
    
    this.config = {
      maxConcurrentTasks: config.maxConcurrentTasks || 3,
      memoryThreshold: config.memoryThreshold || 512, // 512MB
      gcThreshold: config.gcThreshold || 85, // 85%
      priorityQueues: config.priorityQueues ?? true,
      adaptiveTimeout: config.adaptiveTimeout ?? true,
      memoryMonitoring: config.memoryMonitoring ?? true,
      ...config
    };

    this.memoryStats = {
      totalAllocated: 0,
      currentUsage: 0,
      peakUsage: 0,
      tasksActive: 0,
      tasksQueued: 0,
      gcCollections: 0
    };

    this.initializeQueues();
    this.startMemoryMonitoring();

    console.log('🚀 Memory Efficient Executor 初期化完了');
    console.log(`📊 設定: 最大並列=${this.config.maxConcurrentTasks}, メモリ閾値=${this.config.memoryThreshold}MB`);
  }

  /**
   * Execute multiple tasks with memory optimization
   * Fail Fast: Immediate resource validation and task prioritization
   * Be Lazy: Smart scheduling and memory-aware execution
   * TypeScript First: Complete type safety for task execution
   */
  async executeParallel<T>(tasks: ExecutionTask<T>[]): Promise<ExecutionResult<T>[]> {
    console.log(`⚡ 並列実行開始: ${tasks.length}タスク`);
    const startTime = Date.now();

    // Validate memory availability
    const estimatedMemory = tasks.reduce((sum, task) => sum + task.memoryLimit, 0);
    if (estimatedMemory > this.config.memoryThreshold) {
      console.warn(`⚠️ メモリ使用量警告: 推定${estimatedMemory}MB > 閾値${this.config.memoryThreshold}MB`);
      await this.triggerGarbageCollection();
    }

    // Sort tasks by priority and memory efficiency
    const sortedTasks = this.optimizeTaskOrder(tasks);
    
    // Execute tasks in batches with memory monitoring
    const results: ExecutionResult<T>[] = [];
    const batches = this.createMemoryAwareBatches(sortedTasks);

    for (const batch of batches) {
      console.log(`🔄 バッチ実行: ${batch.length}タスク (並列度: ${Math.min(batch.length, this.config.maxConcurrentTasks)})`);
      
      const batchResults = await this.executeBatch(batch);
      results.push(...batchResults);
      
      // Memory cleanup between batches
      await this.performIntermediateCleanup();
    }

    const totalTime = Date.now() - startTime;
    console.log(`✅ 並列実行完了: ${results.length}結果, ${totalTime}ms`);
    
    this.emit('executionComplete', { results, totalTime, memoryStats: this.memoryStats });
    
    return results;
  }

  /**
   * Execute single task with memory tracking
   * Fail Fast: Resource validation and timeout handling
   */
  async executeSingle<T>(task: ExecutionTask<T>): Promise<ExecutionResult<T>> {
    const startTime = Date.now();
    const memoryBefore = this.getCurrentMemoryUsage();
    
    try {
      // Pre-execution validation
      if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
        await this.waitForSlot();
      }

      // Memory check
      if (memoryBefore.used > this.config.memoryThreshold * 0.8) {
        console.warn(`⚠️ メモリ使用量高: ${memoryBefore.used}MB`);
        await this.triggerGarbageCollection();
      }

      this.activeTasks.set(task.id, task);
      this.memoryStats.tasksActive++;

      // Execute with timeout and memory monitoring
      const result = await this.executeWithMemoryMonitoring(task);
      
      const memoryAfter = this.getCurrentMemoryUsage();
      const memoryUsed = Math.max(0, memoryAfter.used - memoryBefore.used);
      
      // Update peak memory usage
      if (memoryAfter.used > this.memoryStats.peakUsage) {
        this.memoryStats.peakUsage = memoryAfter.used;
      }

      return {
        taskId: task.id,
        success: true,
        result,
        executionTime: Date.now() - startTime,
        memoryUsed,
        retryCount: 0
      };

    } catch (error) {
      console.error(`❌ タスク実行失敗: ${task.id}`, error);
      
      return {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
        memoryUsed: 0,
        retryCount: 0
      };
    } finally {
      this.activeTasks.delete(task.id);
      this.memoryStats.tasksActive--;
      
      // Cleanup task resources
      if (task.cleanup) {
        try {
          await task.cleanup();
        } catch (error) {
          console.warn(`⚠️ タスククリーンアップ失敗: ${task.id}`, error);
        }
      }
    }
  }

  /**
   * Get current memory statistics
   * Be Lazy: Efficient memory monitoring
   */
  getMemoryStats(): MemoryStats {
    return { ...this.memoryStats };
  }

  /**
   * Force garbage collection and memory cleanup
   * Fail Fast: Immediate memory recovery
   */
  async forceCleanup(): Promise<void> {
    console.log('🧹 強制メモリクリーンアップ実行中...');
    
    // Cancel low-priority queued tasks if memory is critical
    const memoryUsage = this.getCurrentMemoryUsage();
    if (memoryUsage.used > this.config.memoryThreshold * 0.9) {
      this.cancelLowPriorityTasks();
    }
    
    // Trigger garbage collection
    await this.triggerGarbageCollection();
    
    // Clean up internal caches
    this.clearInternalCaches();
    
    console.log('✅ 強制クリーンアップ完了');
    this.emit('cleanupComplete', this.memoryStats);
  }

  /**
   * Shutdown executor and cleanup all resources
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Memory Efficient Executor シャットダウン中...');
    
    // Clear timers
    if (this.gcTimer) clearInterval(this.gcTimer);
    if (this.monitoringTimer) clearInterval(this.monitoringTimer);
    
    // Cancel all queued tasks
    this.taskQueues.clear();
    
    // Wait for active tasks to complete (with timeout)
    await this.waitForActiveTasks(30000); // 30 second timeout
    
    // Final cleanup
    await this.forceCleanup();
    
    console.log('✅ Memory Efficient Executor シャットダウン完了');
  }

  /**
   * Initialize priority-based task queues
   * Be Lazy: Efficient queue management
   */
  private initializeQueues(): void {
    if (this.config.priorityQueues) {
      this.taskQueues.set('critical', []);
      this.taskQueues.set('high', []);
      this.taskQueues.set('medium', []);
      this.taskQueues.set('low', []);
    }
  }

  /**
   * Start memory monitoring
   * TypeScript First: Type-safe monitoring implementation
   */
  private startMemoryMonitoring(): void {
    if (!this.config.memoryMonitoring) return;

    this.monitoringTimer = setInterval(() => {
      const memoryUsage = this.getCurrentMemoryUsage();
      this.memoryStats.currentUsage = memoryUsage.used;
      
      // Trigger GC if threshold exceeded
      const usagePercentage = (memoryUsage.used / this.config.memoryThreshold) * 100;
      if (usagePercentage > this.config.gcThreshold) {
        console.warn(`⚠️ メモリ使用量が閾値を超過: ${usagePercentage.toFixed(1)}%`);
        this.triggerGarbageCollection();
      }
      
      this.emit('memoryUpdate', this.memoryStats);
    }, 5000); // Check every 5 seconds
  }

  /**
   * Optimize task execution order
   * Be Lazy: Smart scheduling for memory efficiency
   */
  private optimizeTaskOrder<T>(tasks: ExecutionTask<T>[]): ExecutionTask<T>[] {
    return tasks.sort((a, b) => {
      // Primary: Priority
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Secondary: Memory efficiency (lower memory first)
      return a.memoryLimit - b.memoryLimit;
    });
  }

  /**
   * Create memory-aware batches
   * Fail Fast: Prevent memory overflow with smart batching
   */
  private createMemoryAwareBatches<T>(tasks: ExecutionTask<T>[]): ExecutionTask<T>[][] {
    const batches: ExecutionTask<T>[][] = [];
    let currentBatch: ExecutionTask<T>[] = [];
    let currentBatchMemory = 0;
    const maxBatchMemory = this.config.memoryThreshold * 0.7; // Use 70% of threshold per batch

    for (const task of tasks) {
      if (currentBatchMemory + task.memoryLimit > maxBatchMemory && currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBatchMemory = 0;
      }
      
      currentBatch.push(task);
      currentBatchMemory += task.memoryLimit;
      
      // Limit concurrent tasks per batch
      if (currentBatch.length >= this.config.maxConcurrentTasks) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBatchMemory = 0;
      }
    }
    
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }
    
    return batches;
  }

  /**
   * Execute batch of tasks
   */
  private async executeBatch<T>(batch: ExecutionTask<T>[]): Promise<ExecutionResult<T>[]> {
    const promises = batch.map(task => this.executeSingle(task));
    return Promise.all(promises);
  }

  /**
   * Execute task with memory monitoring
   */
  private async executeWithMemoryMonitoring<T>(task: ExecutionTask<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Task timeout: ${task.id}`));
      }, task.timeout);

      task.executor()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemoryUsage(): { used: number; total: number } {
    const usage = process.memoryUsage();
    return {
      used: Math.round(usage.rss / 1024 / 1024), // Convert to MB
      total: Math.round(usage.heapTotal / 1024 / 1024)
    };
  }

  /**
   * Trigger garbage collection
   */
  private async triggerGarbageCollection(): Promise<void> {
    try {
      if (global.gc) {
        console.log('🗑️ ガベージコレクション実行中...');
        global.gc();
        this.memoryStats.gcCollections++;
        
        // Small delay to allow GC to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const memoryAfter = this.getCurrentMemoryUsage();
        console.log(`✅ GC完了: メモリ使用量 ${memoryAfter.used}MB`);
      } else {
        console.warn('⚠️ ガベージコレクションが利用できません (--expose-gc フラグが必要)');
      }
    } catch (error) {
      console.warn('⚠️ ガベージコレクション失敗:', error);
    }
  }

  /**
   * Perform intermediate cleanup between batches
   */
  private async performIntermediateCleanup(): Promise<void> {
    // Small delay to allow memory to settle
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Optional GC if memory usage is high
    const memoryUsage = this.getCurrentMemoryUsage();
    if (memoryUsage.used > this.config.memoryThreshold * 0.6) {
      await this.triggerGarbageCollection();
    }
  }

  /**
   * Cancel low priority tasks to free memory
   */
  private cancelLowPriorityTasks(): void {
    const lowPriorityQueue = this.taskQueues.get('low');
    if (lowPriorityQueue && lowPriorityQueue.length > 0) {
      const canceledCount = lowPriorityQueue.length;
      lowPriorityQueue.length = 0;
      console.log(`🚫 低優先度タスクをキャンセル: ${canceledCount}個`);
      this.memoryStats.tasksQueued -= canceledCount;
    }
  }

  /**
   * Clear internal caches
   */
  private clearInternalCaches(): void {
    // Clear completed task references
    this.activeTasks.clear();
    
    // Reset memory stats (keep peak and counters)
    this.memoryStats.currentUsage = this.getCurrentMemoryUsage().used;
  }

  /**
   * Wait for available execution slot
   */
  private async waitForSlot(): Promise<void> {
    return new Promise((resolve) => {
      const checkSlot = () => {
        if (this.activeTasks.size < this.config.maxConcurrentTasks) {
          resolve();
        } else {
          setTimeout(checkSlot, 100);
        }
      };
      checkSlot();
    });
  }

  /**
   * Wait for all active tasks to complete
   */
  private async waitForActiveTasks(timeout: number): Promise<void> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const check = () => {
        if (this.activeTasks.size === 0 || Date.now() - startTime > timeout) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }
}