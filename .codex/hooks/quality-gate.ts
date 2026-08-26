import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

interface HookInput {
  cwd: string;
  hook_event_name: "SessionStart" | "Stop" | "SessionEnd" | string;
  session_id: string;
  source?: "startup" | "resume" | "clear" | "compact";
}

export interface GateState {
  baseline: string;
  lastPassed?: string;
}

export interface StopResult {
  continue?: boolean;
  decision?: "block";
  reason?: string;
}

const runGit = (cwd: string, args: readonly string[]): Uint8Array => {
  const result = Bun.spawnSync(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString().trim() || `git ${args.join(" ")} failed`);
  }

  return result.stdout;
};

const repositoryRoot = (cwd: string): string =>
  new TextDecoder().decode(runGit(cwd, ["rev-parse", "--show-toplevel"])).trim();

export const stateFilePath = (root: string, sessionId: string): string => {
  const key = createHash("sha256").update(sessionId).digest("hex");
  return join(root, ".codex", "state", `${key}.json`);
};

export const repositoryFingerprint = (root: string): string => {
  const hash = createHash("sha256");
  hash.update(runGit(root, ["rev-parse", "HEAD"]));
  hash.update(runGit(root, ["diff", "--binary", "HEAD"]));

  const untracked = new TextDecoder()
    .decode(runGit(root, ["ls-files", "--others", "--exclude-standard", "-z"]))
    .split("\0")
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  for (const relativePath of untracked) {
    hash.update(relativePath);
    hash.update("\0");
    hash.update(runGit(root, ["hash-object", "--", relativePath]));
    hash.update("\0");
  }

  return hash.digest("hex");
};

const readState = (path: string): GateState | null => {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as GateState;
};

const writeState = (path: string, state: GateState): void => {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(state)}\n`, { mode: 0o600 });
  renameSync(temporaryPath, path);
};

export const shouldValidate = (state: GateState | null, fingerprint: string): boolean =>
  state === null || (state.baseline !== fingerprint && state.lastPassed !== fingerprint);

export const tailText = (value: string, maximumLines = 60, maximumCharacters = 6_000): string => {
  const lines = value.trim().split("\n");
  const tail = lines.slice(-maximumLines).join("\n");
  return tail.length <= maximumCharacters ? tail : tail.slice(-maximumCharacters);
};

export const validationFailure = (exitCode: number, output: string): StopResult => ({
  decision: "block",
  reason: [
    `Repository validation failed with exit code ${exitCode}.`,
    "Fix the failure and rerun bun run validate before completing the task.",
    tailText(output),
  ]
    .filter(Boolean)
    .join("\n\n"),
});

const handleSessionStart = (input: HookInput, root: string, path: string): void => {
  if (input.source === "resume" && readState(path)) {
    process.stdout.write(`${JSON.stringify({ continue: true })}\n`);
    return;
  }

  writeState(path, { baseline: repositoryFingerprint(root) });
  process.stdout.write(`${JSON.stringify({ continue: true })}\n`);
};

const handleStop = (root: string, path: string): void => {
  const state = readState(path);
  const fingerprint = repositoryFingerprint(root);
  if (!shouldValidate(state, fingerprint)) {
    process.stdout.write(`${JSON.stringify({ continue: true })}\n`);
    return;
  }

  const validation = Bun.spawnSync(["bun", "run", "validate"], {
    cwd: root,
    env: { ...process.env, CODEX_QUALITY_GATE: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });

  if (validation.exitCode === 0) {
    writeState(path, { baseline: state?.baseline ?? fingerprint, lastPassed: fingerprint });
    process.stdout.write(`${JSON.stringify({ continue: true })}\n`);
    return;
  }

  const output = `${validation.stdout.toString()}\n${validation.stderr.toString()}`;
  process.stdout.write(`${JSON.stringify(validationFailure(validation.exitCode, output))}\n`);
};

const main = async (): Promise<void> => {
  const rawInput = await Bun.stdin.text();
  const input = JSON.parse(rawInput) as HookInput;
  const root = repositoryRoot(input.cwd);
  const path = stateFilePath(root, input.session_id);

  switch (input.hook_event_name) {
    case "SessionStart":
      handleSessionStart(input, root, path);
      break;
    case "Stop":
      handleStop(root, path);
      break;
    case "SessionEnd":
      rmSync(path, { force: true });
      break;
    default:
      process.stdout.write(`${JSON.stringify({ continue: true })}\n`);
  }
};

if (import.meta.main) {
  await main();
}
