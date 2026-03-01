import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanTempData } from "../utils/local";

describe("cleanTempData", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "test-local-cleanup-"));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("deletes files with bkt- prefix", async () => {
    await writeFile(join(testDir, "bkt-backup-test.gz"), "test");
    await writeFile(join(testDir, "bkt-db-test.sql"), "test");
    await writeFile(join(testDir, "other-file.txt"), "keep");

    await cleanTempData(testDir);

    const remaining = await readdir(testDir);
    expect(remaining).toContain("other-file.txt");
    expect(remaining).not.toContain("bkt-backup-test.gz");
    expect(remaining).not.toContain("bkt-db-test.sql");
  });

  it("ignores non-prefixed files", async () => {
    await writeFile(join(testDir, "important-backup.gz"), "keep");
    await writeFile(join(testDir, "mysql-dump.sql"), "keep");

    await cleanTempData(testDir);

    const remaining = await readdir(testDir);
    expect(remaining).toContain("important-backup.gz");
    expect(remaining).toContain("mysql-dump.sql");
  });

  it("ignores directories even if prefixed with bkt-", async () => {
    await mkdir(join(testDir, "bkt-some-dir"), { recursive: true });
    await writeFile(join(testDir, "bkt-file.gz"), "delete me");

    await cleanTempData(testDir);

    const remaining = await readdir(testDir);
    expect(remaining).toContain("bkt-some-dir");
    expect(remaining).not.toContain("bkt-file.gz");
  });

  it("handles empty directory gracefully", async () => {
    await cleanTempData(testDir);
    const remaining = await readdir(testDir);
    expect(remaining).toEqual([]);
  });

  it("handles nonexistent directory gracefully (no throw)", async () => {
    // Should not throw — the function catches errors internally
    await cleanTempData("/nonexistent-path-12345");
  });
});
