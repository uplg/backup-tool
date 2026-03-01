import { describe, expect, it } from "bun:test";
import { isBackupFile } from "../utils/backup-file";

describe("isBackupFile", () => {
  it("returns true for bkt- prefixed .gz files", () => {
    expect(isBackupFile("bkt-db-dobrunia-1234.gz")).toBe(true);
  });

  it("returns true for bkt- prefixed .tar.gz files", () => {
    expect(isBackupFile("bkt-files-wordpress-1234.tar.gz")).toBe(true);
  });

  it("returns true for bkt- prefixed .zip files", () => {
    expect(isBackupFile("bkt-archive.zip")).toBe(true);
  });

  it("returns false for .gz files without bkt- prefix", () => {
    expect(isBackupFile("backup-2024-01-01.gz")).toBe(false);
  });

  it("returns false for .tar.gz files without bkt- prefix", () => {
    expect(isBackupFile("files-wordpress-2024-01-01.tar.gz")).toBe(false);
  });

  it("returns false for .zip files without bkt- prefix", () => {
    expect(isBackupFile("archive.zip")).toBe(false);
  });

  it("returns false for .sql files", () => {
    expect(isBackupFile("dump.sql")).toBe(false);
  });

  it("returns false for .txt files", () => {
    expect(isBackupFile("readme.txt")).toBe(false);
  });

  it("returns false for files without extension", () => {
    expect(isBackupFile("Dockerfile")).toBe(false);
  });

  it("returns false for dotfiles", () => {
    expect(isBackupFile(".gitignore")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isBackupFile("")).toBe(false);
  });

  it("returns false for .tar files even with bkt- prefix", () => {
    expect(isBackupFile("bkt-archive.tar")).toBe(false);
  });

  it("bkt- prefixed .tar.gz matches the .gz check as well", () => {
    expect(isBackupFile("bkt-test.tar.gz")).toBe(true);
  });
});
