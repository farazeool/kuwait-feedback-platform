import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { copyToClipboard, type CopyResult } from "./copy-signature-button";

describe("copyToClipboard", () => {
  const mockHtml = "<p>Test signature</p>";
  const mockPlainText = "Test signature";

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns copied when ClipboardItem is available and succeeds", async () => {
    const mockWrite = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("ClipboardItem", class ClipboardItem {
      constructor(_data: Record<string, Blob>) {}
    });
    vi.stubGlobal("navigator", {
      clipboard: {
        write: mockWrite,
      },
    });

    const result = await copyToClipboard(mockHtml, mockPlainText);
    expect(result).toBe("copied");
    expect(mockWrite).toHaveBeenCalled();
  });

  it("returns copied when only writeText is available", async () => {
    vi.stubGlobal("ClipboardItem", undefined);
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    const result = await copyToClipboard(mockHtml, mockPlainText);
    expect(result).toBe("copied");
    expect(mockWriteText).toHaveBeenCalledWith(mockPlainText);
  });

  it("returns failed when clipboard APIs are unavailable", async () => {
    vi.stubGlobal("ClipboardItem", undefined);
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("document", {
      createElement: () => ({
        value: "",
        style: { cssText: "" },
        focus: vi.fn(),
        select: vi.fn(),
      }),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
      execCommand: vi.fn(() => false),
    });

    const result = await copyToClipboard(mockHtml, mockPlainText);
    expect(result).toBe("failed");
  });

  it("returns failed when clipboard write throws", async () => {
    const mockWrite = vi.fn().mockRejectedValue(new Error("Clipboard error"));
    vi.stubGlobal("ClipboardItem", class ClipboardItem {
      constructor(_data: Record<string, Blob>) {}
    });
    vi.stubGlobal("navigator", {
      clipboard: {
        write: mockWrite,
      },
    });

    const result = await copyToClipboard(mockHtml, mockPlainText);
    expect(result).toBe("failed");
  });
});