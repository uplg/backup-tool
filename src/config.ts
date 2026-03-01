import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ConnectConfig } from "ssh2";
import type { DBConfig } from "./utils/database";
import type { FileBackupConfig } from "./utils/files";

export interface BackupConfig {
  settings: {
    backupOnInit: boolean;
    scheduleExpression: string;
    maxFileAge: number;
    allowSelfSigned: boolean;
  };
  dbs: DBConfig[];
  files: FileBackupConfig[];
  providers: ProviderConfig[];
}

export type ProviderConfig = SFTPProviderConfig | FTPProviderConfig;

export interface SFTPProviderConfig {
  name: string;
  type: "sftp";
  destination: string;
  connection: ConnectConfig;
}

export interface FTPProviderConfig {
  name: string;
  type: "ftp" | "ftpes";
  destination: string;
  connection: {
    host: string;
    port?: number;
    user?: string;
    password?: string;
    secure?: boolean | "implicit";
  };
}

const VALID_PROVIDER_TYPES = new Set(["sftp", "ftp", "ftpes"]);

function loadConfig(): BackupConfig {
  const configPath = join(__dirname, "..", "config.json");
  const raw = JSON.parse(readFileSync(configPath, "utf-8"));

  // Basic validation
  if (!raw.settings?.scheduleExpression) {
    throw new Error("Config: settings.scheduleExpression is required");
  }
  if (!Array.isArray(raw.providers) || raw.providers.length === 0) {
    throw new Error("Config: at least one provider is required");
  }

  // Ensure dbs have a type field
  const dbs: DBConfig[] = (raw.dbs ?? []).map((db: Record<string, unknown>) => {
    if (!db.type) {
      throw new Error(
        `Config: database "${db.name}" is missing a "type" field (mysql | docker-postgres)`,
      );
    }
    return db as unknown as DBConfig;
  });

  // Ensure files have required fields
  const files: FileBackupConfig[] = (raw.files ?? []).map((f: Record<string, unknown>) => {
    if (!f.name) {
      throw new Error('Config: file entry is missing a "name" field');
    }
    if (f.type === "docker-volume") {
      if (!f.container || !f.containerPath) {
        throw new Error(
          `Config: docker-volume file "${f.name}" requires "container" and "containerPath"`,
        );
      }
    } else {
      if (!f.source) {
        throw new Error(`Config: file entry "${f.name}" is missing a "source" field`);
      }
    }
    return f as unknown as FileBackupConfig;
  });

  // Validate providers
  const providers: ProviderConfig[] = raw.providers.map((p: Record<string, unknown>, i: number) => {
    if (!p.name) {
      throw new Error(`Config: provider at index ${i} is missing a "name" field`);
    }
    if (!p.type || !VALID_PROVIDER_TYPES.has(p.type as string)) {
      throw new Error(
        `Config: provider "${p.name}" has invalid type "${p.type}" (expected sftp | ftp | ftpes)`,
      );
    }
    if (!p.destination) {
      throw new Error(`Config: provider "${p.name}" is missing a "destination" field`);
    }
    if (!p.connection || typeof p.connection !== "object") {
      throw new Error(`Config: provider "${p.name}" is missing a "connection" object`);
    }
    return p as unknown as ProviderConfig;
  });

  return {
    settings: {
      backupOnInit: raw.settings.backupOnInit ?? false,
      scheduleExpression: raw.settings.scheduleExpression,
      maxFileAge: raw.settings.maxFileAge ?? 7,
      allowSelfSigned: raw.settings.allowSelfSigned ?? false,
    },
    dbs,
    files,
    providers,
  };
}

const config = loadConfig();
export default config;
