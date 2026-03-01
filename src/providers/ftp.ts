import { basename, posix } from "node:path";
import { Client } from "basic-ftp";
import config, { type FTPProviderConfig } from "../config";
import { isBackupFile } from "../utils/backup-file";
import { ageInDays } from "../utils/date";
import logger from "../utils/logger";
import type { Provider } from ".";

/** Timeout for FTP connections (30s) */
const CONNECT_TIMEOUT = 30_000;

export default class FTPProvider implements Provider {
  constructor(public config: FTPProviderConfig) {}

  private async connect(): Promise<Client> {
    const client = new Client(CONNECT_TIMEOUT);
    const { host, port, user, password, secure } = this.config.connection;
    await client.access({
      host,
      port: port ?? 21,
      user: user ?? "anonymous",
      password: password ?? "",
      secure: secure ?? this.config.type === "ftpes",
    });
    return client;
  }

  async send(file: string): Promise<void> {
    const client = await this.connect();
    try {
      const remotePath = posix.join(this.config.destination, basename(file));
      await client.uploadFrom(file, remotePath);
      logger.info(`File ${file} sent to ${this.config.name}`);
    } finally {
      client.close();
    }
  }

  async cleanup(): Promise<void> {
    const client = await this.connect();
    try {
      const fileListing = await client.list(this.config.destination);

      for (const file of fileListing) {
        if (!isBackupFile(file.name) || !file.modifiedAt) continue;

        const age = ageInDays(file.modifiedAt);
        if (age > config.settings.maxFileAge) {
          const remotePath = posix.join(this.config.destination, file.name);
          logger.info(`Deleting file ${file.name} in ${this.config.name}`);
          await client.remove(remotePath);
        }
      }
    } finally {
      client.close();
    }
  }
}
