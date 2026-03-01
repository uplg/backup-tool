import { exec, execFile } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream";
import { promisify } from "node:util";
import { createGzip } from "node:zlib";

import logger from "./logger";

export interface MySQLDBConfig {
  type: "mysql";
  host: string;
  user: string;
  password: string;
  name: string;
}

export interface DockerPostgresDBConfig {
  type: "docker-postgres";
  container: string;
  user: string;
  name: string;
}

export type DBConfig = MySQLDBConfig | DockerPostgresDBConfig;

/** Max stderr buffer for exec calls (1MB) */
const EXEC_MAX_BUFFER = 1024 * 1024;

/** Timeout for database dump commands (10 minutes) */
const EXEC_TIMEOUT = 10 * 60 * 1000;

/**
 * Backup a MySQL database using mysqldump.
 * Uses execFile to avoid shell injection.
 */
async function backupMySQL(config: MySQLDBConfig): Promise<string> {
  const backupFilePath = join(tmpdir(), `bkt-backup-${config.name}-${Date.now()}.sql`);

  const args = [
    "-h",
    config.host,
    "-u",
    config.user,
    `--password=${config.password}`,
    "--result-file",
    backupFilePath,
    config.name,
  ];

  await promisify(execFile)("mysqldump", args, { timeout: EXEC_TIMEOUT });
  return backupFilePath;
}

/**
 * Backup a PostgreSQL database running in a Docker container
 * using `docker exec` + `pg_dump`.
 * Streams the output directly to a file to avoid buffering in memory.
 */
async function backupDockerPostgres(config: DockerPostgresDBConfig): Promise<string> {
  const backupFilePath = join(tmpdir(), `bkt-backup-${config.name}-${Date.now()}.sql`);

  // Use exec with shell redirection so the dump streams straight to disk.
  // Container name and db name are validated to be alphanumeric + hyphens/underscores.
  const safeContainer = sanitizeName(config.container);
  const safeUser = sanitizeName(config.user);
  const safeDbName = sanitizeName(config.name);

  const command = `docker exec ${safeContainer} pg_dump -U ${safeUser} ${safeDbName} > "${backupFilePath}"`;
  await promisify(exec)(command, {
    maxBuffer: EXEC_MAX_BUFFER,
    timeout: EXEC_TIMEOUT,
  });

  return backupFilePath;
}

/**
 * Sanitize a name to prevent shell injection.
 * Only allows alphanumeric, hyphens, underscores, and dots.
 */
export function sanitizeName(name: string): string {
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
    throw new Error(
      `Invalid name "${name}": only alphanumeric characters, dots, hyphens and underscores are allowed`,
    );
  }
  return name;
}

/**
 * Backup a database based on its config type.
 */
export async function backupDatabase(config: DBConfig): Promise<string> {
  logger.info(`Starting database backup: ${config.name} (${config.type})`);

  if (config.type === "mysql") {
    return backupMySQL(config);
  } else if (config.type === "docker-postgres") {
    return backupDockerPostgres(config);
  } else {
    throw new Error(`Unknown database type: ${(config as { type: string }).type}`);
  }
}

/**
 * Compress a SQL dump file to .gz, then delete the uncompressed file.
 * Fully streamed — constant memory usage.
 */
export async function compressBackup(config: DBConfig, backupFilePath: string): Promise<string> {
  const compressedFilePath = join(tmpdir(), `bkt-db-${config.name}-${Date.now()}.gz`);
  const input = createReadStream(backupFilePath);
  const output = createWriteStream(compressedFilePath);
  const gzip = createGzip();
  await promisify(pipeline)(input, gzip, output);

  // Remove uncompressed dump immediately to free disk space
  await unlink(backupFilePath);

  return compressedFilePath;
}
