import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Progress } from "../utils/progress";

// Mock the logger to capture log calls
const mockInfo = mock();
const mockError = mock();
const mockWarn = mock();

mock.module("../utils/logger", () => ({
  default: {
    info: mockInfo,
    error: mockError,
    warn: mockWarn,
  },
}));

describe("Progress", () => {
  beforeEach(() => {
    mockInfo.mockClear();
    mockError.mockClear();
    mockWarn.mockClear();
  });

  it("logs steps with correct counter format", () => {
    const progress = new Progress(3);
    progress.step("Database dump: dobrunia");
    progress.step("Archive files: wordpress");

    expect(mockInfo).toHaveBeenCalledWith("[1/3] Database dump: dobrunia");
    expect(mockInfo).toHaveBeenCalledWith("[2/3] Archive files: wordpress");
  });

  it("records failures and logs them", () => {
    const progress = new Progress(2);
    progress.step("Database dump: dobrunia");
    progress.fail("connection refused");

    expect(mockError).toHaveBeenCalledWith("[1/2] FAILED: connection refused");
  });

  it("summary reports all OK when no errors", () => {
    const progress = new Progress(2);
    progress.step("Step 1");
    progress.step("Step 2");
    progress.summary(5000);

    expect(mockInfo).toHaveBeenCalledWith("Backup complete: 2/2 steps OK (5.0s)");
  });

  it("summary reports errors when some steps failed", () => {
    const progress = new Progress(3);
    progress.step("Step 1");
    progress.step("Step 2");
    progress.fail("disk full");
    progress.step("Step 3");
    progress.summary(12345);

    expect(mockWarn).toHaveBeenCalledWith(
      "Backup done with errors: 2/3 steps OK, 1 failed (12.3s)",
    );
    expect(mockWarn).toHaveBeenCalledWith("  - disk full");
  });

  it("handles zero duration", () => {
    const progress = new Progress(1);
    progress.step("Quick step");
    progress.summary(0);

    expect(mockInfo).toHaveBeenCalledWith("Backup complete: 1/1 steps OK (0.0s)");
  });

  it("handles multiple failures", () => {
    const progress = new Progress(3);
    progress.step("Step 1");
    progress.fail("error 1");
    progress.step("Step 2");
    progress.fail("error 2");
    progress.step("Step 3");
    progress.summary(1000);

    expect(mockWarn).toHaveBeenCalledWith("Backup done with errors: 1/3 steps OK, 2 failed (1.0s)");
    expect(mockWarn).toHaveBeenCalledWith("  - error 1");
    expect(mockWarn).toHaveBeenCalledWith("  - error 2");
  });
});
