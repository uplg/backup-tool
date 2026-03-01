import { readdir, stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import logger from "./logger";

/** Prefix used for all temp files created by backup-tool */
const TEMP_PREFIX = "bkt-";

/**
 * Cleanup temp files created by backup-tool.
 * Only deletes files that start with our prefix to avoid
 * nuking other applications' temp files.
 */
export async function cleanTempData(dir?: string): Promise<void> {
  const targetDir = dir ?? tmpdir();

  try {
    const files = await readdir(targetDir);
    for (const file of files) {
      if (!file.startsWith(TEMP_PREFIX)) continue;

      const filePath = `${targetDir}/${file}`;
      try {
        const stats = await stat(filePath);
        if (stats.isFile()) {
          await unlink(filePath);
          logger.info(`Temp file removed: ${file}`);
        }
      } catch (err) {
        logger.warn(`Could not remove temp file ${file}: ${err}`);
      }
    }
  } catch (err) {
    logger.error(`Error while cleaning temp files in ${targetDir}: ${err}`);
  }
}
