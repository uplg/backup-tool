import logger from "./logger";

/**
 * Simple progress tracker that logs each step of the backup job.
 * Format: [3/8] Archiving files: dobrunia-wordpress
 */
export class Progress {
  private current = 0;
  private total: number;
  private errors: string[] = [];

  constructor(total: number) {
    this.total = total;
  }

  /** Log the start of a step */
  step(message: string): void {
    this.current++;
    logger.info(`[${this.current}/${this.total}] ${message}`);
  }

  /** Record a failed step (logged separately, doesn't stop progress) */
  fail(message: string): void {
    this.errors.push(message);
    logger.error(`[${this.current}/${this.total}] FAILED: ${message}`);
  }

  /** Log the final summary */
  summary(durationMs: number): void {
    const duration = (durationMs / 1000).toFixed(1);
    const succeeded = this.total - this.errors.length;

    if (this.errors.length === 0) {
      logger.info(`Backup complete: ${succeeded}/${this.total} steps OK (${duration}s)`);
    } else {
      logger.warn(
        `Backup done with errors: ${succeeded}/${this.total} steps OK, ${this.errors.length} failed (${duration}s)`,
      );
      for (const err of this.errors) {
        logger.warn(`  - ${err}`);
      }
    }
  }
}
