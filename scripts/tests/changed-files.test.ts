import { describe, expect, test } from "bun:test";
import { isBiomeFile, parseNullSeparated } from "../quality/changed-files.ts";

describe("changed-file quality selection", () => {
  test("parses Git null-separated output without empty entries", () => {
    expect(parseNullSeparated("apps/game/src/main.ts\0package.json\0")).toEqual([
      "apps/game/src/main.ts",
      "package.json",
    ]);
  });

  test("selects supported source and configuration files", () => {
    expect(isBiomeFile("src/main.ts")).toBeTrue();
    expect(isBiomeFile("package.json")).toBeTrue();
    expect(isBiomeFile("styles/main.css")).toBeTrue();
    expect(isBiomeFile("docs/guide.md")).toBeFalse();
    expect(isBiomeFile("assets/icon.png")).toBeFalse();
  });
});
