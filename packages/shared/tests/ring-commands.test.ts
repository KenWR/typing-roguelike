import { describe, expect, test } from "bun:test";
import { RING_BY_ID } from "../src/content/rings.ts";
import type { SkillConfig } from "../src/content/types.ts";
import {
  MAX_RING_DAMAGE_MULTIPLIER,
  applyRingModifiersToSkill,
  resolveSkillCommands,
} from "../src/rules/ring-commands.ts";

const slash = (): SkillConfig => ({
  id: "skill.slash",
  name: "베기",
  command: "베기",
  kind: "attack",
  category: "basic",
  apCost: 2,
  windupMs: 400,
  recoveryMs: 200,
  damageCoefficient: 1,
  description: "기본 베기",
});

describe("ring command resolution", () => {
  test("keeps the base command and adds prefix, suffix, and combined commands", () => {
    const commands = resolveSkillCommands(slash(), [
      "ring_swift_prefix",
      "ring_chain_suffix",
    ]);

    expect(commands.map(({ command }) => command)).toEqual([
      "베기",
      "신속한 베기",
      "베기 연속으로",
      "신속한 베기 연속으로",
    ]);
    expect(commands[0]!.sourceRingIds).toEqual([]);
    expect(commands[3]!).toMatchObject({
      prefix: "신속한",
      baseCommand: "베기",
      suffix: "연속으로",
      sourceRingIds: ["ring_swift_prefix", "ring_chain_suffix"],
    });
  });

  test("does not mutate the base skill while applying AP, windup, damage, and on-hit modifiers", () => {
    const base = slash();
    const swift = RING_BY_ID.get("ring_swift_prefix")!;
    const bleed = RING_BY_ID.get("ring_bleed_suffix")!;
    const modified = applyRingModifiersToSkill(base, [swift, bleed]);

    expect(base).toEqual(slash());
    expect(modified).not.toBe(base);
    expect(modified.windupMs).toBe(300);
    expect(modified.apCost).toBe(2);
    expect(modified.effects).toContainEqual({
      type: "status",
      statusId: "bleed",
      durationMs: 4_000,
      stacks: 1,
    });
  });

  test("uses RingConfig.position rather than ring slot order", () => {
    const commands = resolveSkillCommands(slash(), [
      "ring_chain_suffix",
      "ring_swift_prefix",
    ]);

    expect(commands.map(({ command }) => command)).toContain("신속한 베기 연속으로");
    const combined = commands.find(({ command }) => command === "신속한 베기 연속으로")!;
    expect(combined.sourceRingIds).toEqual(["ring_swift_prefix", "ring_chain_suffix"]);
  });

  test("never applies two prefixes or two suffixes to one command", () => {
    const commands = resolveSkillCommands(slash(), [
      "ring_swift_prefix",
      "ring_fury_prefix",
    ]);

    expect(commands.map(({ command }) => command)).toEqual([
      "베기",
      "신속한 베기",
      "맹렬한 베기",
    ]);
    expect(commands.every(({ sourceRingIds }) => sourceRingIds.length <= 1)).toBe(true);
  });

  test("caps the combined ring damage increase at +100%", () => {
    const skill = slash();
    const overpowered = [
      {
        id: "test-prefix",
        name: "test",
        position: "prefix" as const,
        commandAffix: "강한",
        rarity: "legendary" as const,
        sellValue: 1,
        description: "test",
        modifiers: [{ damageMultiplier: 2 }],
      },
      {
        id: "test-suffix",
        name: "test2",
        position: "suffix" as const,
        commandAffix: "더 강하게",
        rarity: "legendary" as const,
        sellValue: 1,
        description: "test",
        modifiers: [{ damageMultiplier: 2 }],
      },
    ];

    const modified = applyRingModifiersToSkill(skill, overpowered);
    expect(MAX_RING_DAMAGE_MULTIPLIER).toBe(2);
    expect(modified.damageCoefficient).toBe(2);
    expect(modified.effects).toContainEqual({ type: "damage", coefficient: 2 });
  });

  test("clamps AP cost at zero", () => {
    const economy = RING_BY_ID.get("ring_economy_prefix")!;
    const modified = applyRingModifiersToSkill({ ...slash(), apCost: 0 }, [economy]);
    expect(modified.apCost).toBe(0);
  });
});
