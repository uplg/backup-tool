import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdir, mkdtemp, rm, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archiveFiles } from "../utils/files";

// Mock the logger
mock.module("../utils/logger", () => ({
  default: {
    info: mock(),
    warn: mock(),
    error: mock(),
  },
}));

describe("archiveFiles — host directory", () => {
  let testDir: string;
  let sourceDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "bkt-test-files-"));
    sourceDir = join(testDir, "source");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(join(sourceDir, "file1.txt"), "hello world");
    await writeFile(join(sourceDir, "file2.txt"), "foo bar baz");
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("creates a tar.gz archive of a host directory", async () => {
    const result = await archiveFiles({
      name: "test-archive",
      source: sourceDir,
    });

    expect(result).toEndWith(".tar.gz");

    const stats = await stat(result);
    expect(stats.size).toBeGreaterThan(0);

    await unlink(result).catch(() => {});
  });

  it("throws if source directory does not exist", async () => {
    expect(
      archiveFiles({
        name: "nonexistent",
        source: "/tmp/definitely-does-not-exist-12345",
      }),
    ).rejects.toThrow("Source path does not exist");
  });

  it("handles exclude patterns", async () => {
    await mkdir(join(sourceDir, "cache"), { recursive: true });
    await writeFile(join(sourceDir, "cache", "temp.txt"), "cached");

    const result = await archiveFiles({
      name: "test-exclude",
      source: sourceDir,
      exclude: ["cache"],
    });

    expect(result).toEndWith(".tar.gz");

    const stats = await stat(result);
    expect(stats.size).toBeGreaterThan(0);

    await unlink(result).catch(() => {});
  });
});
