import type { EnemyActionConfig } from "@typing-roguelike/shared";
import type { EnemyAttackType } from "./enemy-attack-timeline";

const DEBUFF_WORDS = /약화|기절|출혈|균열|감소|감속|지연|저주|역순|봉인|고정|debuff|weaken|stun|bleed|crack/i;
const BUFF_WORDS = /회복|치유|강화|보호막|가속|반사|buff|heal|shield|repair|haste|reflect/i;

/** Maps a data-driven action to the telegraph bar's color and label category. */
export const resolveEnemyAttackType = (
  action: Pick<EnemyActionConfig, "kind" | "damage" | "description" | "apDelta" | "name">,
): EnemyAttackType => {
  if (action.kind === "defense") return "defense";

  // The shared enemy factory appends this suffix to generic special attacks.
  // Remove it before looking for status keywords so every generic special is
  // not mistaken for a buff merely because it has a generated description.
  const description = `${action.name} ${action.description.replace(/\s+강화 효과$/, "")}`;
  if (BUFF_WORDS.test(description) && action.apDelta === undefined) return "buff";
  if (action.apDelta !== undefined && action.apDelta < 0) return "debuff";
  if (DEBUFF_WORDS.test(description)) return "debuff";
  if (action.damage <= 0) return BUFF_WORDS.test(description) ? "buff" : "debuff";
  return "attack";
};
