import { exec } from "node:child_process";
import { rm, stat } from "node:fs/promises";
import { platform, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

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

  const excludeArgs = (config.exclude ?? []).map((pattern) => `--exclude='${pattern}'`).join(" ");

  const parentDir = join(config.source, "..");
  const baseName = config.source.split("/").pop() ?? config.source;

  const command = [
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

  logger.info(`Archiving ${config.source} -> ${outputPath}`);
  await promisify(exec)(command, { maxBuffer: 1024 * 1024 }).catch((err) => {
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
  const outputPath = join(tmpdir(), `bkt-files-${config.name}-${Date.now()}.tar.gz`);
  const tempDir = join(tmpdir(), `bkt-docker-${config.name}-${Date.now()}`);

  try {
    // docker cp extracts the content into tempDir
    const cpCommand = `docker cp "${config.container}:${config.containerPath}" "${tempDir}"`;
    logger.info(`Copying from container ${config.container}:${config.containerPath}`);
    await promisify(exec)(cpCommand, { maxBuffer: 1024 * 1024 });

    // tar.gz the extracted content
    const excludeArgs = (config.exclude ?? []).map((pattern) => `--exclude='${pattern}'`).join(" ");

    const command = [
      "nice -n 19",
      platform() === "linux" ? "ionice -c 3" : "",
      "tar",
      "-czf",
      `"${outputPath}"`,
      excludeArgs,
      `-C "${join(tempDir, "..")}"`,
      `"${tempDir.split("/").pop()}"`,
    ]
      .filter(Boolean)
      .join(" ");

    logger.info(`Archiving docker volume ${config.name} -> ${outputPath}`);
    await promisify(exec)(command, { maxBuffer: 1024 * 1024 }).catch((err) => {
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
