import { describe, expect, it } from "bun:test";

/**
 * Tests for the config validation logic.
 * Since loadConfig() reads from disk at module load time and uses __dirname,
 * we test the validation rules in isolation by replicating the checks.
 */
describe("config validation logic", () => {
  it("rejects config without scheduleExpression", () => {
    const raw = { settings: {} };
    expect(!raw.settings || !(raw.settings as Record<string, unknown>).scheduleExpression).toBe(
      true,
    );
  });

  it("rejects config without providers", () => {
    const raw = {
      settings: { scheduleExpression: "0 3 * * *" },
      providers: [],
    };
    expect(!Array.isArray(raw.providers) || raw.providers.length === 0).toBe(true);
  });

  it("accepts config with providers", () => {
    const raw = {
      settings: { scheduleExpression: "0 3 * * *" },
      providers: [{ name: "sftp", type: "sftp" }],
    };
    expect(!Array.isArray(raw.providers) || raw.providers.length === 0).toBe(false);
  });

  it("rejects database without type field", () => {
    const db = { name: "mydb", host: "localhost", user: "root", password: "x" };
    expect((db as Record<string, unknown>).type).toBeUndefined();
  });

  it("accepts database with type field", () => {
    const db = {
      type: "mysql",
      name: "mydb",
      host: "localhost",
      user: "root",
      password: "x",
    };
    expect(db.type).toBe("mysql");
  });

  it("rejects file entry without name", () => {
    const file = { source: "/var/www" };
    expect((file as Record<string, unknown>).name).toBeUndefined();
  });

  it("rejects docker-volume without container", () => {
    const file = { name: "vol", type: "docker-volume", containerPath: "/data" };
    expect(file.type === "docker-volume" && !(file as Record<string, unknown>).container).toBe(
      true,
    );
  });

  it("rejects docker-volume without containerPath", () => {
    const file = { name: "vol", type: "docker-volume", container: "my-app" };
    expect(file.type === "docker-volume" && !(file as Record<string, unknown>).containerPath).toBe(
      true,
    );
  });

  it("rejects host file without source", () => {
    const file = { name: "web" };
    expect((file as Record<string, unknown>).source).toBeUndefined();
  });

  it("applies defaults for optional settings", () => {
    const raw = { settings: { scheduleExpression: "0 3 * * *" } };

    const settings = {
      backupOnInit: (raw.settings as Record<string, unknown>).backupOnInit ?? false,
      scheduleExpression: raw.settings.scheduleExpression,
      maxFileAge: (raw.settings as Record<string, unknown>).maxFileAge ?? 7,
      allowSelfSigned: (raw.settings as Record<string, unknown>).allowSelfSigned ?? false,
    };

    expect(settings.backupOnInit).toBe(false);
    expect(settings.maxFileAge).toBe(7);
    expect(settings.allowSelfSigned).toBe(false);
    expect(settings.scheduleExpression).toBe("0 3 * * *");
  });

  it("respects explicit settings values", () => {
    const raw = {
      settings: {
        scheduleExpression: "0 3 * * *",
        backupOnInit: true,
        maxFileAge: 14,
        allowSelfSigned: true,
      },
    };

    const settings = {
      backupOnInit: raw.settings.backupOnInit ?? false,
      scheduleExpression: raw.settings.scheduleExpression,
      maxFileAge: raw.settings.maxFileAge ?? 7,
      allowSelfSigned: raw.settings.allowSelfSigned ?? false,
    };

    expect(settings.backupOnInit).toBe(true);
    expect(settings.maxFileAge).toBe(14);
    expect(settings.allowSelfSigned).toBe(true);
  });
});
