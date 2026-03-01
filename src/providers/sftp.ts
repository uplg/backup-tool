import { createReadStream } from "node:fs";
import { basename, posix } from "node:path";
import { Client } from "ssh2";
import config, { type SFTPProviderConfig } from "../config";
import { isBackupFile } from "../utils/backup-file";
import { ageInDays } from "../utils/date";
import logger from "../utils/logger";
import type { Provider } from ".";

/** Timeout for SFTP connections (30s) */
const CONNECT_TIMEOUT = 30_000;

export default class SFTPProvider implements Provider {
  constructor(public config: SFTPProviderConfig) {}

  async send(file: string): Promise<void> {
    const client = new Client();
    await new Promise<void>((resolve, reject) => {
      client.on("ready", () => {
        client.sftp((err, sftp) => {
          if (err) {
            client.end();
            return reject(err);
          }
          const localStream = createReadStream(file);
          const remotePath = posix.join(this.config.destination, basename(file));
          const remoteStream = sftp.createWriteStream(remotePath);
          localStream
            .pipe(remoteStream)
            .on("error", (err: Error) => {
              client.end();
              reject(err);
            })
            .on("close", () => {
              logger.info(`File ${file} sent to ${this.config.name}`);
              client.end();
              resolve();
            });
        });
      });
      client.on("error", reject);
      client.connect({
        ...this.config.connection,
        readyTimeout: CONNECT_TIMEOUT,
      });
    });
  }

  async cleanup(): Promise<void> {
    const client = new Client();
    await new Promise<void>((resolve, reject) => {
      client.on("ready", () => {
        client.sftp((err, sftp) => {
          if (err) {
            client.end();
            return reject(err);
          }
          sftp.readdir(this.config.destination, (err, files) => {
            if (err) {
              client.end();
              return reject(err);
            }

            const deletePromises = files
              .filter((file) => isBackupFile(file.filename))
              .map((file) => ({
                ...file,
                age: ageInDays(new Date(file.attrs.mtime * 1000)),
              }))
              .filter((file) => file.age > config.settings.maxFileAge)
              .map((file) => {
                const filePath = posix.join(this.config.destination, file.filename);
                return new Promise<void>((resolve, reject) => {
                  sftp.unlink(filePath, (err) => {
                    if (err) return reject(err);
                    logger.info(`Deleting file ${file.filename} in ${this.config.name}`);
                    resolve();
                  });
                });
              });

            Promise.all(deletePromises)
              .then(() => {
                client.end();
                resolve();
              })
              .catch((err) => {
                client.end();
                reject(err);
              });
          });
        });
      });
      client.on("error", reject);
      client.connect({
        ...this.config.connection,
        readyTimeout: CONNECT_TIMEOUT,
      });
    });
  }
}
