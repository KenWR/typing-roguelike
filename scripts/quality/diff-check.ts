import { resolveQualityBase } from "./changed-files.ts";

const run = (args: readonly string[]): void => {
  const result = Bun.spawnSync(["git", ...args], {
    cwd: process.cwd(),
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) process.exit(result.exitCode);
};

const capture = (args: readonly string[]): string => {
  const result = Bun.spawnSync(["git", ...args], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    console.error(result.stderr.toString());
    process.exit(result.exitCode);
  }
  return result.stdout.toString().trim();
};

const root = capture(["rev-parse", "--show-toplevel"]);
const base = resolveQualityBase(root);
if (base) {
  const mergeBase = capture(["merge-base", "HEAD", base]);
  run(["diff", "--check", `${mergeBase}...HEAD`]);
}
run(["diff", "--check", "HEAD"]);
