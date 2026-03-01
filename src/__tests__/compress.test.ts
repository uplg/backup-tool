import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdtemp, rm, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compressBackup } from "../utils/database";

// Mock the logger
mock.module("../utils/logger", () => ({
  default: {
    info: mock(),
    warn: mock(),
    error: mock(),
  },
}));

describe("compressBackup", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "bkt-test-compress-"));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("compresses a SQL file and deletes the original", async () => {
    // Create a fake SQL dump
    const sqlPath = join(testDir, "bkt-backup-test.sql");
    const content = "CREATE TABLE test; INSERT INTO test VALUES (1);".repeat(100);
    await writeFile(sqlPath, content);

    const config = {
      type: "mysql" as const,
      host: "localhost",
      user: "root",
      password: "x",
      name: "testdb",
    };
    const result = await compressBackup(config, sqlPath);

    // Result should be a .gz file
    expect(result).toEndWith(".gz");

    // Original SQL file should be deleted
    expect(stat(sqlPath)).rejects.toThrow();

    // Compressed file should exist and be smaller
    const compressedStats = await stat(result);
    expect(compressedStats.size).toBeGreaterThan(0);
    expect(compressedStats.size).toBeLessThan(content.length);

    // Cleanup
    await unlink(result).catch(() => {});
  });
});
