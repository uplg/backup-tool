import { describe, expect, it } from "bun:test";
import { isBackupFile } from "../utils/backup-file";

describe("isBackupFile", () => {
  it("returns true for .gz files", () => {
    expect(isBackupFile("backup-2024-01-01.gz")).toBe(true);
  });

  it("returns true for .tar.gz files", () => {
    expect(isBackupFile("files-wordpress-2024-01-01.tar.gz")).toBe(true);
  });

  it("returns true for .zip files", () => {
    expect(isBackupFile("archive.zip")).toBe(true);
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

  it("handles .tar files (not .tar.gz) as false", () => {
    expect(isBackupFile("archive.tar")).toBe(false);
  });

  // .tar.gz also ends with .gz so it matches both checks — that's fine
  it(".tar.gz matches the .gz check as well", () => {
    expect(isBackupFile("test.tar.gz")).toBe(true);
  });
});
