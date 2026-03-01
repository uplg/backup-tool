import { unlink } from "node:fs/promises";
import { parseArgs } from "node:util";
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

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    only: { type: "string" },
  },
  strict: false,
});

const onlyFilter: Set<string> | null =
  typeof args.only === "string"
    ? new Set(args.only.split(",").map((s) => s.trim()))
    : null;

const providers = config.providers.map((description) => {
  if (isFTP(description)) {
    return new FTPProvider(description);
  } else if (isSFTP(description)) {
    return new SFTPProvider(description);
  } else {
    throw new Error(
      `Unknown provider type: ${(description as { type: string }).type}`,
    );
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

async function backupJob(filter: Set<string> | null): Promise<void> {
  const startTime = Date.now();
  const isPartial = filter !== null;

  const dbs = filter
    ? config.dbs.filter((db) => filter.has(db.name))
    : config.dbs;
  const files = filter
    ? config.files.filter((f) => filter.has(f.name))
    : config.files;

  if (isPartial && dbs.length === 0 && files.length === 0) {
    logger.error(`No backup targets matched --only "${[...filter].join(",")}"`);
    const allNames = [
      ...config.dbs.map((d) => d.name),
      ...config.files.map((f) => f.name),
    ];
    logger.info(`Available targets: ${allNames.join(", ")}`);
    return;
  }

  // Steps: each db + each file + cleanup phases (skipped when partial)
  const totalSteps = dbs.length + files.length + (isPartial ? 0 : 2);
  const progress = new Progress(totalSteps);

  if (isPartial) {
    logger.info(`=== Partial backup: ${[...filter].join(", ")} ===`);
  } else {
    logger.info("=== Backup job started ===");
  }

  try {
    // Phase 1: Database backups
    for (const db of dbs) {
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
    for (const fileConfig of files) {
      progress.step(`Archive files: ${fileConfig.name}`);
      try {
        const archivePath = await archiveFiles(fileConfig);
        await sendToProviders(archivePath, `files:${fileConfig.name}`);
        await unlink(archivePath).catch(() => {});
      } catch (err) {
        progress.fail(`files ${fileConfig.name}: ${err}`);
      }
    }

    // Phase 3 & 4: Cleanup (skipped for partial runs)
    if (!isPartial) {
      progress.step("Remote cleanup: removing old backups from providers");
      for (const provider of providers) {
        try {
          await provider.cleanup();
        } catch (err) {
          logger.error(
            `Error during cleanup for ${provider.config.name}: ${err}`,
          );
        }
      }

      progress.step("Local cleanup: removing temp files");
      try {
        await cleanTempData();
      } catch (err) {
        logger.error(`Error during local cleanup: ${err}`);
      }
    }

    progress.summary(Date.now() - startTime);
  } catch (err) {
    logger.error(`Fatal error during backup: ${err}`);
  }
}

// --only: run immediately and exit, no cron
if (onlyFilter) {
  backupJob(onlyFilter);
} else {
  schedule(config.settings.scheduleExpression, async () => {
    await backupJob(null);
  });

  if (config.settings.backupOnInit) {
    backupJob(null);
  }
}

process.on("uncaughtException", (err) => {
  logger.error(`uncaughtException: ${err}`);
});

process.on("unhandledRejection", (err) => {
  logger.error(`unhandledRejection: ${err}`);
});
