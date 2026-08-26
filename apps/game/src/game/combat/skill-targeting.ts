import type { SkillDefinition } from "@typing-roguelike/shared";

const AREA_WORDS = /광역|모든 적|전체 적|주위|area|all enemies/i;

/** Resolves legacy Korean skill descriptions and future area tags consistently. */
export const isAreaSkill = (skill: Pick<SkillDefinition, "description" | "effect" | "tags">): boolean => {
  if (skill.tags?.some((tag) => tag.toLowerCase() === "area" || tag.toLowerCase() === "aoe")) return true;
  return AREA_WORDS.test(`${skill.description} ${skill.effect ?? ""}`);
};
