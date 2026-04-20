import { describe, it, expect } from "vitest";
import {
  normalizeComparablePath,
  isWindowsAbsolutePath,
} from "./pathUtils";

describe("normalizeComparablePath", () => {
  it("returns undefined for empty input", () => {
    expect(normalizeComparablePath("")).toBeUndefined();
    expect(normalizeComparablePath(undefined)).toBeUndefined();
    expect(normalizeComparablePath("   ")).toBeUndefined();
  });

  it("replaces backslashes with forward slashes", () => {
    expect(normalizeComparablePath("C:\\Users\\me", {}, "linux")).toBe(
      "C:/Users/me",
    );
  });

  it("strips trailing slashes while preserving root", () => {
    expect(normalizeComparablePath("/foo/bar/", {}, "linux")).toBe("/foo/bar");
    expect(normalizeComparablePath("/", {}, "linux")).toBe("/");
  });

  it("trims whitespace", () => {
    expect(normalizeComparablePath("  /foo  ", {}, "linux")).toBe("/foo");
  });

  describe("caseFolding: auto", () => {
    it("lowercases on win32", () => {
      expect(normalizeComparablePath("/Foo/Bar", {}, "win32")).toBe("/foo/bar");
    });

    it("lowercases on darwin", () => {
      expect(normalizeComparablePath("/Foo/Bar", {}, "darwin")).toBe(
        "/foo/bar",
      );
    });

    it("preserves case on linux", () => {
      expect(normalizeComparablePath("/Foo/Bar", {}, "linux")).toBe("/Foo/Bar");
    });
  });

  describe("caseFolding: win32-only", () => {
    it("lowercases on win32", () => {
      expect(
        normalizeComparablePath(
          "/Foo/Bar",
          { caseFolding: "win32-only" },
          "win32",
        ),
      ).toBe("/foo/bar");
    });

    it("preserves case on darwin", () => {
      expect(
        normalizeComparablePath(
          "/Foo/Bar",
          { caseFolding: "win32-only" },
          "darwin",
        ),
      ).toBe("/Foo/Bar");
    });
  });

  describe("caseFolding: always / never", () => {
    it("always lowercases regardless of platform", () => {
      expect(
        normalizeComparablePath(
          "/Foo/Bar",
          { caseFolding: "always" },
          "linux",
        ),
      ).toBe("/foo/bar");
    });

    it("never lowercases regardless of platform", () => {
      expect(
        normalizeComparablePath(
          "/Foo/Bar",
          { caseFolding: "never" },
          "win32",
        ),
      ).toBe("/Foo/Bar");
    });
  });

  describe("resolveRelative", () => {
    it("resolves relative paths when enabled", () => {
      const result = normalizeComparablePath(
        "relative/path",
        { resolveRelative: true, caseFolding: "never" },
        "linux",
      );
      expect(result).toBeDefined();
      expect(result!.startsWith("/")).toBe(true);
      expect(result!.endsWith("relative/path")).toBe(true);
    });

    it("preserves absolute Unix paths", () => {
      expect(
        normalizeComparablePath(
          "/absolute/path",
          { resolveRelative: true, caseFolding: "never" },
          "linux",
        ),
      ).toBe("/absolute/path");
    });

    it("preserves Windows drive-letter paths", () => {
      expect(
        normalizeComparablePath(
          "C:\\Users\\me",
          { resolveRelative: true, caseFolding: "never" },
          "win32",
        ),
      ).toBe("C:/Users/me");
    });
  });

  it("handles Windows drive-letter paths with mixed separators", () => {
    expect(normalizeComparablePath("D:\\Projects/foo\\bar", {}, "win32")).toBe(
      "d:/projects/foo/bar",
    );
  });
});

describe("isWindowsAbsolutePath", () => {
  it("detects drive-letter paths with backslash", () => {
    expect(isWindowsAbsolutePath("C:\\Users\\me")).toBe(true);
    expect(isWindowsAbsolutePath("D:\\Projects")).toBe(true);
  });

  it("detects drive-letter paths with forward slash", () => {
    expect(isWindowsAbsolutePath("C:/Users/me")).toBe(true);
  });

  it("detects UNC paths with backslashes", () => {
    expect(isWindowsAbsolutePath("\\\\server\\share")).toBe(true);
  });

  it("detects UNC paths with forward slashes", () => {
    expect(isWindowsAbsolutePath("//server/share")).toBe(true);
  });

  it("rejects Unix absolute paths", () => {
    expect(isWindowsAbsolutePath("/usr/local/bin")).toBe(false);
  });

  it("rejects relative paths", () => {
    expect(isWindowsAbsolutePath("src/foo.ts")).toBe(false);
    expect(isWindowsAbsolutePath("foo")).toBe(false);
  });
});
