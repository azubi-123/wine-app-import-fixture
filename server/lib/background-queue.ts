/**
 * Simple Background Job Queue
 * P1-005: Track and retry background jobs instead of fire-and-forget
 *
 * This is a simple in-memory queue for MVP. For production scale,
 * consider using BullMQ with Redis.
 */

type JobFunction = () => Promise<void>;

interface Job {
  id: string;
  name: string;
  fn: JobFunction;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

interface QueueOptions {
  maxConcurrency?: number;
  defaultMaxAttempts?: number;
  retryDelayMs?: number;
}

/**
 * Simple in-memory background job queue with retries
 */
export class BackgroundQueue {
  private jobs: Map<string, Job> = new Map();
  private running: number = 0;
  private maxConcurrency: number;
  private defaultMaxAttempts: number;
  private retryDelayMs: number;
  private jobCounter: number = 0;

  constructor(options: QueueOptions = {}) {
    this.maxConcurrency = options.maxConcurrency ?? 3;
    this.defaultMaxAttempts = options.defaultMaxAttempts ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 2000;
  }

  /**
   * Add a job to the queue
   */
  add(name: string, fn: JobFunction, maxAttempts?: number): string {
    const id = `job_${++this.jobCounter}_${Date.now()}`;
    const job: Job = {
      id,
      name,
      fn,
      attempts: 0,
      maxAttempts: maxAttempts ?? this.defaultMaxAttempts,
      status: 'pending',
      createdAt: new Date()
    };

    this.jobs.set(id, job);
    console.log(`[Queue] Added job ${id}: ${name}`);

    // Start processing if we have capacity
    this.processNext();

    return id;
  }

  /**
   * Process the next pending job
   */
  private async processNext(): Promise<void> {
    if (this.running >= this.maxConcurrency) {
      return;
    }

    // Find next pending job
    const pendingJob = Array.from(this.jobs.values()).find(j => j.status === 'pending');
    if (!pendingJob) {
      return;
    }

    this.running++;
    pendingJob.status = 'running';
    pendingJob.attempts++;

    console.log(`[Queue] Running job ${pendingJob.id}: ${pendingJob.name} (attempt ${pendingJob.attempts}/${pendingJob.maxAttempts})`);

    try {
      await pendingJob.fn();
      pendingJob.status = 'completed';
      pendingJob.completedAt = new Date();
      console.log(`[Queue] Completed job ${pendingJob.id}: ${pendingJob.name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Queue] Failed job ${pendingJob.id}: ${pendingJob.name} - ${errorMessage}`);

      if (pendingJob.attempts < pendingJob.maxAttempts) {
        // Retry after delay
        pendingJob.status = 'pending';
        pendingJob.error = errorMessage;
        console.log(`[Queue] Will retry job ${pendingJob.id} in ${this.retryDelayMs}ms`);
        setTimeout(() => this.processNext(), this.retryDelayMs);
      } else {
        pendingJob.status = 'failed';
        pendingJob.error = errorMessage;
        console.error(`[Queue] Job ${pendingJob.id} failed permanently after ${pendingJob.attempts} attempts`);
      }
    } finally {
      this.running--;
      // Process next job
      this.processNext();
    }
  }

  /**
   * Get job status
   */
  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    total: number;
  } {
    const jobs = Array.from(this.jobs.values());
    return {
      pending: jobs.filter(j => j.status === 'pending').length,
      running: jobs.filter(j => j.status === 'running').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      total: jobs.length
    };
  }

  /**
   * Clean up old completed/failed jobs (keep last N)
   */
  cleanup(keepLast: number = 100): void {
    const jobs = Array.from(this.jobs.entries())
      .filter(([, j]) => j.status === 'completed' || j.status === 'failed')
      .sort((a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime());

    const toRemove = jobs.slice(0, Math.max(0, jobs.length - keepLast));
    for (const [id] of toRemove) {
      this.jobs.delete(id);
    }

    if (toRemove.length > 0) {
      console.log(`[Queue] Cleaned up ${toRemove.length} old jobs`);
    }
  }
}

// Singleton instance for wine intelligence background jobs
export const wineIntelQueue = new BackgroundQueue({
  maxConcurrency: 3,
  defaultMaxAttempts: 3,
  retryDelayMs: 2000
});

// Clean up old jobs every hour
setInterval(() => wineIntelQueue.cleanup(100), 60 * 60 * 1000);
