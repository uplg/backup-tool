import { describe, expect, it } from "bun:test";
import { isFTP, isSFTP } from "../providers";
import type { ProviderConfig } from "../config";

describe("isSFTP", () => {
  it("returns true for sftp provider", () => {
    const config = {
      name: "test",
      type: "sftp",
      destination: "/backups",
      connection: {},
    };
    expect(isSFTP(config as ProviderConfig)).toBe(true);
  });

  it("returns false for ftp provider", () => {
    const config = {
      name: "test",
      type: "ftp",
      destination: "/backups",
      connection: {},
    };
    expect(isSFTP(config as ProviderConfig)).toBe(false);
  });

  it("returns false for ftpes provider", () => {
    const config = {
      name: "test",
      type: "ftpes",
      destination: "/backups",
      connection: {},
    };
    expect(isSFTP(config as ProviderConfig)).toBe(false);
  });
});

describe("isFTP", () => {
  it("returns true for ftp provider", () => {
    const config = {
      name: "test",
      type: "ftp",
      destination: "/backups",
      connection: {},
    };
    expect(isFTP(config as ProviderConfig)).toBe(true);
  });

  it("returns true for ftpes provider", () => {
    const config = {
      name: "test",
      type: "ftpes",
      destination: "/backups",
      connection: {},
    };
    expect(isFTP(config as ProviderConfig)).toBe(true);
  });

  it("returns false for sftp provider", () => {
    const config = {
      name: "test",
      type: "sftp",
      destination: "/backups",
      connection: {},
    };
    expect(isFTP(config as ProviderConfig)).toBe(false);
  });
});
