import { exec } from "node:child_process";
import { rm, stat } from "node:fs/promises";
import { platform, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { sanitizeName } from "./database";
import logger from "./logger";

export interface HostFileBackupConfig {
  type?: "host";
  name: string;
  source: string;
  exclude?: string[];
}

export interface DockerVolumeBackupConfig {
  type: "docker-volume";
  name: string;
  container: string;
  containerPath: string;
  exclude?: string[];
}

export type FileBackupConfig = HostFileBackupConfig | DockerVolumeBackupConfig;

/** Max stderr buffer for exec calls (1MB — only captures warnings, not data) */
const EXEC_MAX_BUFFER = 1024 * 1024;

/** Timeout for exec calls (10 minutes) */
const EXEC_TIMEOUT = 10 * 60 * 1000;

/**
 * Sanitize a filesystem path for safe shell interpolation.
 * Allows alphanumeric, hyphens, underscores, dots, and forward slashes.
 */
function sanitizePath(path: string): string {
  if (!/^[a-zA-Z0-9._/ -]+$/.test(path)) {
    throw new Error(
      `Invalid path "${path}": only alphanumeric characters, dots, hyphens, underscores, spaces and slashes are allowed`,
    );
  }
  return path;
}

/**
 * Build a tar command with nice/ionice prefix.
 */
function buildTarCommand(
  outputPath: string,
  parentDir: string,
  baseName: string,
  exclude?: string[],
): string {
  const excludeArgs = (exclude ?? []).map((pattern) => `--exclude='${pattern}'`).join(" ");

  return [
    "nice -n 19",
    platform() === "linux" ? "ionice -c 3" : "",
    "tar",
    "-czf",
    `"${outputPath}"`,
    excludeArgs,
    `-C "${parentDir}"`,
    `"${baseName}"`,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Archive files based on the config type.
 * - "host" (default): tar.gz a directory on the host filesystem
 * - "docker-volume": docker cp from a container, then tar.gz
 */
export async function archiveFiles(config: FileBackupConfig): Promise<string> {
  if (config.type === "docker-volume") {
    return archiveDockerVolume(config);
  }
  return archiveHostDir(config);
}

/**
 * Archive a host directory using tar.
 * Streams directly to gzip — constant memory usage.
 */
async function archiveHostDir(config: HostFileBackupConfig): Promise<string> {
  const outputPath = join(tmpdir(), `bkt-files-${config.name}-${Date.now()}.tar.gz`);

  // Verify source exists
  try {
    await stat(config.source);
  } catch {
    throw new Error(`Source path does not exist: ${config.source}`);
  }

  const parentDir = join(config.source, "..");
  const baseName = config.source.split("/").pop() ?? config.source;
  const command = buildTarCommand(outputPath, parentDir, baseName, config.exclude);

  logger.info(`Archiving ${config.source} -> ${outputPath}`);
  await promisify(exec)(command, {
    maxBuffer: EXEC_MAX_BUFFER,
    timeout: EXEC_TIMEOUT,
  }).catch((err) => {
    if (err.code === 1) {
      logger.warn(`tar warnings for ${config.name}: ${err.stderr}`);
      return;
    }
    throw err;
  });

  return outputPath;
}

/**
 * Archive files from a Docker container's named volume.
 * Uses `docker cp` to extract files to a temp dir, then tar.gz that dir.
 * The temp dir is cleaned up after archiving.
 */
async function archiveDockerVolume(config: DockerVolumeBackupConfig): Promise<string> {
  const safeContainer = sanitizeName(config.container);
  const safePath = sanitizePath(config.containerPath);

  const outputPath = join(tmpdir(), `bkt-files-${config.name}-${Date.now()}.tar.gz`);
  const tempDir = join(tmpdir(), `bkt-docker-${config.name}-${Date.now()}`);

  try {
    // docker cp extracts the content into tempDir
    const cpCommand = `docker cp "${safeContainer}:${safePath}" "${tempDir}"`;
    logger.info(`Copying from container ${safeContainer}:${safePath}`);
    await promisify(exec)(cpCommand, {
      maxBuffer: EXEC_MAX_BUFFER,
      timeout: EXEC_TIMEOUT,
    });

    // tar.gz the extracted content
    const command = buildTarCommand(
      outputPath,
      join(tempDir, ".."),
      tempDir.split("/").pop()!,
      config.exclude,
    );

    logger.info(`Archiving docker volume ${config.name} -> ${outputPath}`);
    await promisify(exec)(command, {
      maxBuffer: EXEC_MAX_BUFFER,
      timeout: EXEC_TIMEOUT,
    }).catch((err) => {
      if (err.code === 1) {
        logger.warn(`tar warnings for ${config.name}: ${err.stderr}`);
        return;
      }
      throw err;
    });

    return outputPath;
  } finally {
    // Always clean up the temp extraction dir
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
