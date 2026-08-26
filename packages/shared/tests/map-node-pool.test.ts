import { describe, expect, test } from "bun:test";
import { generateNodeChoices } from "../src/rules/map-generation.ts";

const allowedTypes = new Set(["combat", "elite", "shop", "rest", "boss"]);

describe("map node pool", () => {
  test("never generates reward nodes", () => {
    for (let seed = 0; seed < 50; seed += 1) {
      let paths: number[][] = [[]];
      for (let round = 1; round <= 8; round += 1) {
        const nextPaths: number[][] = [];
        for (const path of paths) {
          const nodes = generateNodeChoices(seed, round, path);
          expect(nodes.every((node) => allowedTypes.has(node.type))).toBe(true);
          expect(nodes.some((node) => node.type === "reward")).toBe(false);
          for (const node of nodes) nextPaths.push([...path, node.choice]);
        }
        paths = nextPaths.slice(0, 12);
      }
    }
  });

  test("round 9 is one rest node and round 10 is one boss node", () => {
    const pathToRound9 = Array.from({ length: 8 }, () => 1);
    const restNodes = generateNodeChoices(17, 9, pathToRound9);
    expect(restNodes).toHaveLength(1);
    expect(restNodes[0]?.type).toBe("rest");
    expect(restNodes[0]?.nextNodeKeys).toHaveLength(1);

    const bossNodes = generateNodeChoices(17, 10, [...pathToRound9, restNodes[0]!.choice]);
    expect(bossNodes).toHaveLength(1);
    expect(bossNodes[0]?.type).toBe("boss");
  });
});
