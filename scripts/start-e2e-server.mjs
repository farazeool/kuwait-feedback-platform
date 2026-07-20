import { execFileSync, spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const status = execFileSync(resolve(root, "node_modules/.bin/supabase"), ["status", "-o", "env"], {
  cwd: root,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
const values = Object.fromEntries(
  status.split("\n").flatMap((line) => {
    const match = line.match(/^([A-Z_]+)="(.*)"$/);
    return match ? [[match[1], match[2]]] : [];
  }),
);

if (!values.API_URL || !values.ANON_KEY) {
  throw new Error("The local Supabase stack is required for browser tests.");
}

const child = spawn(
  resolve(root, "node_modules/.bin/next"),
  ["dev", "--hostname", "127.0.0.1", "--port", "3100"],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: values.API_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: values.ANON_KEY,
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
      SUPABASE_SERVICE_ROLE_KEY: "local-e2e-placeholder-not-used-by-ordinary-requests",
      SUBMISSION_FINGERPRINT_SECRET: "local-e2e-fingerprint-secret-at-least-32-characters",
    },
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => process.exit(code ?? 0));
