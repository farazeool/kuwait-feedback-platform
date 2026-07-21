import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.[cm]?[jt]sx?$/.test(path) ? [path] : [];
  });
}

describe("browser secret boundary", () => {
  it("never references server-only credentials or modules from a client module", () => {
    const clientModules = sourceFiles(join(process.cwd(), "src")).filter((path) =>
      /^\s*["']use client["'];/m.test(readFileSync(path, "utf8")),
    );
    const violations = clientModules.filter((path) => /SUPABASE_SERVICE_ROLE_KEY|getServerEnv|createSupabaseServiceClient|features\/bot-protection\/server/.test(readFileSync(path, "utf8")));
    expect(violations).toEqual([]);
  });

  it("keeps the public environment reader free of server credentials", () => {
    const publicReader = readFileSync(join(process.cwd(), "src/lib/env/client.ts"), "utf8");
    expect(publicReader).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
