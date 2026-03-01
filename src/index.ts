import { unlink } from "node:fs/promises";
import { schedule } from "node-cron";

import config from "./config";
import { FTPProvider, isFTP, isSFTP, SFTPProvider } from "./providers";
import { backupDatabase, compressBackup } from "./utils/database";
import { archiveFiles } from "./utils/files";
import { cleanTempData } from "./utils/local";
import logger from "./utils/logger";
import { Progress } from "./utils/progress";

if (config.settings.allowSelfSigned) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const providers = config.providers.map((description) => {
  if (isFTP(description)) {
    return new FTPProvider(description);
  } else if (isSFTP(description)) {
    return new SFTPProvider(description);
  } else {
    throw new Error(`Unknown provider type: ${(description as { type: string }).type}`);
  }
});

async function sendToProviders(filePath: string, label: string): Promise<void> {
  const jobs = providers.map(async (provider) => {
    try {
      await provider.send(filePath);
    } catch (err) {
      logger.error(`Error sending ${label} to ${provider.config.name}: ${err}`);
    }
  });
  await Promise.all(jobs);
}

async function backupJob(): Promise<void> {
  const startTime = Date.now();

  // Each DB = dump + compress + send (1 step)
  // Each file entry = archive + send (1 step)
  // + remote cleanup (1 step)
  // + local cleanup (1 step)
  const totalSteps =
    config.dbs.length + config.files.length + 1 /* remote cleanup */ + 1; /* local cleanup */
  const progress = new Progress(totalSteps);

  logger.info("=== Backup job started ===");

  try {
    // Phase 1: Database backups
    for (const db of config.dbs) {
      progress.step(`Database dump: ${db.name} (${db.type})`);
      try {
        const backupFilePath = await backupDatabase(db);
        const compressedFilePath = await compressBackup(db, backupFilePath);
        await sendToProviders(compressedFilePath, `db:${db.name}`);
        await unlink(compressedFilePath).catch(() => {});
      } catch (err) {
        progress.fail(`database ${db.name}: ${err}`);
      }
    }

    // Phase 2: File backups
    for (const fileConfig of config.files) {
      progress.step(`Archive files: ${fileConfig.name}`);
      try {
        const archivePath = await archiveFiles(fileConfig);
        await sendToProviders(archivePath, `files:${fileConfig.name}`);
        await unlink(archivePath).catch(() => {});
      } catch (err) {
        progress.fail(`files ${fileConfig.name}: ${err}`);
      }
    }

    // Phase 3: Remote cleanup
    progress.step("Remote cleanup: removing old backups from providers");
    for (const provider of providers) {
      try {
        await provider.cleanup();
      } catch (err) {
        logger.error(`Error during cleanup for ${provider.config.name}: ${err}`);
      }
    }

    // Phase 4: Local temp cleanup
    progress.step("Local cleanup: removing temp files");
    try {
      await cleanTempData();
    } catch (err) {
      logger.error(`Error during local cleanup: ${err}`);
    }

    progress.summary(Date.now() - startTime);
  } catch (err) {
    logger.error(`Fatal error during backup: ${err}`);
  }
}

schedule(config.settings.scheduleExpression, async () => {
  await backupJob();
});

if (config.settings.backupOnInit) {
  backupJob();
}

process.on("uncaughtException", (err) => {
  logger.error(`uncaughtException: ${err}`);
});

process.on("unhandledRejection", (err) => {
  logger.error(`unhandledRejection: ${err}`);
});
