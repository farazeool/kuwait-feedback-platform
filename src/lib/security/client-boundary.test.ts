import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
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

describe("client component boundary", () => {
  // Guards against the runtime crash "Event handlers cannot be passed to Client
  // Component props": inline DOM event handlers or client-only hooks in a module
  // that lacks a "use client" directive compile cleanly and pass typecheck/lint,
  // but throw when the (dynamic) route is actually rendered.
  const CLIENT_HOOKS = [
    "useState",
    "useEffect",
    "useLayoutEffect",
    "useReducer",
    "useRef",
    "useContext",
    "useMemo",
    "useCallback",
    "useImperativeHandle",
    "useTransition",
    "useDeferredValue",
    "useSyncExternalStore",
    "useId",
    "useFormStatus",
    "useFormState",
    "useActionState",
    "useOptimistic",
    "useRouter",
    "usePathname",
    "useSearchParams",
    "useSelectedLayoutSegment",
    "useSelectedLayoutSegments",
  ];
  const EVENT_HANDLER = /\bon[A-Z][A-Za-z]*=\{/;

  it("only uses client-only APIs in modules marked \"use client\"", () => {
    const violations: string[] = [];
    for (const path of sourceFiles(join(process.cwd(), "src"))) {
      if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(path)) continue;
      const source = readFileSync(path, "utf8");
      if (/^\s*["']use client["'];/m.test(source)) continue;

      const reasons: string[] = [];
      if (EVENT_HANDLER.test(source)) reasons.push("inline event handler (onX={…})");
      const hook = CLIENT_HOOKS.find((name) => new RegExp(`\\b${name}\\s*\\(`).test(source));
      if (hook) reasons.push(`client hook (${hook})`);
      if (reasons.length > 0) {
        violations.push(`${relative(process.cwd(), path)} — ${reasons.join(", ")}`);
      }
    }
    expect(violations, `Add "use client" to these modules or move the client-only code into a client component:\n${violations.join("\n")}`).toEqual([]);
  });
});
