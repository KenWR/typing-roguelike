import { existsSync } from "node:fs";
import { join } from "node:path";

const BIOME_EXTENSIONS = new Set([".css", ".js", ".json", ".jsonc", ".jsx", ".ts", ".tsx"]);

const runGit = (root: string, args: readonly string[]): string => {
  const result = Bun.spawnSync(["git", ...args], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString().trim() || `git ${args.join(" ")} failed`);
  }

  return result.stdout.toString();
};

export const parseNullSeparated = (value: string): string[] => value.split("\0").filter(Boolean);

export const isBiomeFile = (file: string): boolean => {
  const dot = file.lastIndexOf(".");
  return dot >= 0 && BIOME_EXTENSIONS.has(file.slice(dot));
};

const refExists = (root: string, ref: string): boolean => {
  const result = Bun.spawnSync(["git", "rev-parse", "--verify", "--quiet", `${ref}^{commit}`], {
    cwd: root,
    stdout: "ignore",
    stderr: "ignore",
  });
  return result.exitCode === 0;
};

export const resolveQualityBase = (root: string, environment: NodeJS.ProcessEnv = process.env): string | null => {
  const requested = environment.QUALITY_BASE_SHA?.trim();
  if (requested && refExists(root, requested)) return requested;

  const githubBase = environment.GITHUB_BASE_REF?.trim();
  if (githubBase && refExists(root, `origin/${githubBase}`)) return `origin/${githubBase}`;

  return refExists(root, "origin/main") ? "origin/main" : null;
};

export const collectChangedFiles = (root: string, environment: NodeJS.ProcessEnv = process.env): string[] => {
  const files = new Set<string>();
  const base = resolveQualityBase(root, environment);

  if (base) {
    const mergeBase = runGit(root, ["merge-base", "HEAD", base]).trim();
    for (const file of parseNullSeparated(
      runGit(root, ["diff", "--name-only", "--diff-filter=ACMR", "-z", `${mergeBase}...HEAD`]),
    )) {
      files.add(file);
    }
  }

  for (const file of parseNullSeparated(runGit(root, ["diff", "--name-only", "--diff-filter=ACMR", "-z", "HEAD"]))) {
    files.add(file);
  }

  for (const file of parseNullSeparated(runGit(root, ["ls-files", "--others", "--exclude-standard", "-z"]))) {
    files.add(file);
  }

  return [...files]
    .filter(isBiomeFile)
    .filter((file) => existsSync(join(root, file)))
    .sort((left, right) => left.localeCompare(right));
};

const main = (): never => {
  const [command, ...options] = Bun.argv.slice(2);
  if (!command || !["check", "format", "lint"].includes(command)) {
    console.error("Usage: bun scripts/quality/changed-files.ts <check|format|lint> [biome-options]");
    process.exit(2);
  }

  const root = runGit(process.cwd(), ["rev-parse", "--show-toplevel"]).trim();
  const files = collectChangedFiles(root);
  if (files.length === 0) {
    console.log("No changed Biome-supported files.");
    process.exit(0);
  }

  const executable = join(root, "node_modules", ".bin", process.platform === "win32" ? "biome.cmd" : "biome");
  if (!existsSync(executable)) {
    console.error("Biome is unavailable. Run bun install --frozen-lockfile.");
    process.exit(127);
  }

  console.log(`Biome ${command}: ${files.length} changed file(s).`);
  const result = Bun.spawnSync([executable, command, "--no-errors-on-unmatched", ...options, ...files], {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  });
  process.exit(result.exitCode);
};

if (import.meta.main) main();
