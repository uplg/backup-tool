import type { ProviderConfig } from "../config";
import FTPProvider from "./ftp";
import SFTPProvider from "./sftp";

export interface Provider {
  config: ProviderConfig;
  send(file: string): Promise<void>;
  cleanup(): Promise<void>;
}

export function isSFTP(config: ProviderConfig): config is ProviderConfig & { type: "sftp" } {
  return config.type === "sftp";
}

export function isFTP(
  config: ProviderConfig,
): config is ProviderConfig & { type: "ftp" | "ftpes" } {
  return config.type === "ftp" || config.type === "ftpes";
}

export { SFTPProvider, FTPProvider };
