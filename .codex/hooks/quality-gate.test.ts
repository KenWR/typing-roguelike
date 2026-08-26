import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { repositoryFingerprint, shouldValidate, stateFilePath, tailText, validationFailure } from "./quality-gate.ts";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

const git = (cwd: string, ...args: string[]): void => {
  const result = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
};

const runHook = async (cwd: string, input: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const child = Bun.spawn(["bun", join(import.meta.dir, "quality-gate.ts")], {
    cwd,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  child.stdin.write(JSON.stringify(input));
  child.stdin.end();
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (exitCode !== 0) throw new Error(stderr);
  return JSON.parse(stdout) as Record<string, unknown>;
};

const createRepository = (): string => {
  const root = mkdtempSync(join(tmpdir(), "typing-roguelike-hook-"));
  temporaryDirectories.push(root);
  git(root, "init", "--quiet");
  git(root, "config", "user.email", "hook-test@example.com");
  git(root, "config", "user.name", "Hook Test");
  writeFileSync(join(root, ".gitignore"), ".codex/state/\n");
  writeFileSync(join(root, "tracked.txt"), "initial\n");
  git(root, "add", ".gitignore", "tracked.txt");
  git(root, "commit", "--quiet", "-m", "test: initialize fixture");
  return root;
};

describe("quality gate state", () => {
  test("configures baseline, stop, and cleanup lifecycle events", () => {
    const config = JSON.parse(readFileSync(join(import.meta.dir, "..", "hooks.json"), "utf8")) as {
      hooks: Record<string, unknown[]>;
    };
    expect(Object.keys(config.hooks).sort()).toEqual(["SessionEnd", "SessionStart", "Stop"]);
    expect(config.hooks.Stop).toHaveLength(1);
  });

  test("uses a stable session-scoped state path", () => {
    const first = stateFilePath("/repo", "session/one");
    expect(first).toBe(stateFilePath("/repo", "session/one"));
    expect(first).not.toBe(stateFilePath("/repo", "session/two"));
    expect(first.startsWith("/repo/.codex/state/")).toBeTrue();
  });

  test("validates only repository states that have not passed", () => {
    expect(shouldValidate(null, "current")).toBeTrue();
    expect(shouldValidate({ baseline: "current" }, "current")).toBeFalse();
    expect(shouldValidate({ baseline: "old", lastPassed: "current" }, "current")).toBeFalse();
    expect(shouldValidate({ baseline: "old", lastPassed: "older" }, "current")).toBeTrue();
  });
});

describe("repository fingerprint", () => {
  test("changes for tracked edits, commits, and untracked content", () => {
    const root = createRepository();
    const initial = repositoryFingerprint(root);

    writeFileSync(join(root, "tracked.txt"), "edited\n");
    const edited = repositoryFingerprint(root);
    expect(edited).not.toBe(initial);

    git(root, "add", "tracked.txt");
    git(root, "commit", "--quiet", "-m", "test: edit fixture");
    expect(repositoryFingerprint(root)).not.toBe(initial);

    writeFileSync(join(root, "untracked.txt"), "first\n");
    const untracked = repositoryFingerprint(root);
    writeFileSync(join(root, "untracked.txt"), "second\n");
    expect(repositoryFingerprint(root)).not.toBe(untracked);
  });
});

describe("failure output", () => {
  test("keeps concise tail output and asks for another validation pass", () => {
    expect(tailText("one\ntwo\nthree", 2, 100)).toBe("two\nthree");
    const result = validationFailure(1, "first failure\nlast failure");
    expect(result.decision).toBe("block");
    expect(result.reason).toContain("bun run validate");
    expect(result.reason).toContain("last failure");
  });
});

describe("hook lifecycle", () => {
  test("blocks Stop when the repository validation command fails", async () => {
    const root = createRepository();
    writeFileSync(join(root, "package.json"), '{"scripts":{"validate":"exit 7"}}\n');
    git(root, "add", "package.json");
    git(root, "commit", "--quiet", "-m", "test: add failing validation");

    const sessionId = "failing-session";
    expect(
      await runHook(root, { cwd: root, hook_event_name: "SessionStart", session_id: sessionId, source: "startup" }),
    ).toEqual({ continue: true });
    writeFileSync(join(root, "tracked.txt"), "changed\n");

    const stopped = await runHook(root, { cwd: root, hook_event_name: "Stop", session_id: sessionId });
    expect(stopped.decision).toBe("block");
    expect(stopped.reason).toContain("exit code 7");
  });

  test("allows Stop and caches a passing repository fingerprint", async () => {
    const root = createRepository();
    writeFileSync(join(root, "package.json"), '{"scripts":{"validate":"exit 0"}}\n');
    git(root, "add", "package.json");
    git(root, "commit", "--quiet", "-m", "test: add passing validation");

    const sessionId = "passing-session";
    await runHook(root, { cwd: root, hook_event_name: "SessionStart", session_id: sessionId, source: "startup" });
    writeFileSync(join(root, "tracked.txt"), "changed\n");

    expect(await runHook(root, { cwd: root, hook_event_name: "Stop", session_id: sessionId })).toEqual({
      continue: true,
    });
    expect(await runHook(root, { cwd: root, hook_event_name: "Stop", session_id: sessionId })).toEqual({
      continue: true,
    });
  });
});
