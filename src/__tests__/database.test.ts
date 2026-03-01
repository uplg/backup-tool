import { describe, expect, it } from "bun:test";
import { sanitizeName } from "../utils/database";

describe("sanitizeName", () => {
  it("accepts simple alphanumeric names", () => {
    expect(sanitizeName("mydb")).toBe("mydb");
  });

  it("accepts names with hyphens", () => {
    expect(sanitizeName("agnes-postgres")).toBe("agnes-postgres");
  });

  it("accepts names with underscores", () => {
    expect(sanitizeName("agnes_stones")).toBe("agnes_stones");
  });

  it("accepts names with dots", () => {
    expect(sanitizeName("backup.2024")).toBe("backup.2024");
  });

  it("accepts mixed valid characters", () => {
    expect(sanitizeName("my-db_v2.0")).toBe("my-db_v2.0");
  });

  it("rejects names with spaces", () => {
    expect(() => sanitizeName("my db")).toThrow("Invalid name");
  });

  it("rejects names with semicolons (shell injection)", () => {
    expect(() => sanitizeName("db; rm -rf /")).toThrow("Invalid name");
  });

  it("rejects names with backticks", () => {
    expect(() => sanitizeName("db`whoami`")).toThrow("Invalid name");
  });

  it("rejects names with dollar signs", () => {
    expect(() => sanitizeName("db$HOME")).toThrow("Invalid name");
  });

  it("rejects names with pipes", () => {
    expect(() => sanitizeName("db|cat /etc/passwd")).toThrow("Invalid name");
  });

  it("rejects names with quotes", () => {
    expect(() => sanitizeName('db"test')).toThrow("Invalid name");
    expect(() => sanitizeName("db'test")).toThrow("Invalid name");
  });

  it("rejects empty string", () => {
    expect(() => sanitizeName("")).toThrow("Invalid name");
  });

  it("rejects names with slashes", () => {
    expect(() => sanitizeName("db/test")).toThrow("Invalid name");
    expect(() => sanitizeName("db\\test")).toThrow("Invalid name");
  });

  it("rejects names with newlines", () => {
    expect(() => sanitizeName("db\ntest")).toThrow("Invalid name");
  });
});
