import {
  EQUIPMENT_CONFIGS,
  type GeneratedMapNode,
  type RunState,
  type SkillDefinition,
} from "@typing-roguelike/shared";
import type { CombatEncounterInitialization } from "./encounter-initializer";
import { CombatState, type CombatUpdate } from "./combat-state";
import { EnemyAttackTimeline } from "./enemy-attack-timeline";
import {
  SkillCombatantState,
  SkillImpactResolver,
} from "./skill-impact-resolver";
import {
  finalizeCombatOutcome,
  type CombatOutcomeRoute,
} from "./combat-outcome-routing";

export type PlayerCombatRuntimeConfig = Readonly<{
  combat: CombatState;
  enemyTimeline: EnemyAttackTimeline;
  runState: Readonly<RunState>;
  initialization: CombatEncounterInitialization;
  nextNodeIds?: readonly string[];
  bossNode?: GeneratedMapNode;
}>;

export type PlayerCombatRuntimeUpdate = Readonly<{
  combat: CombatUpdate;
  enemyHp: Readonly<Record<string, number>>;
  route: CombatOutcomeRoute | null;
}>;

const resolveAttackPower = (
  initialization: CombatEncounterInitialization,
): number => {
  const total = initialization.player.equipmentIds.reduce((sum, equipmentId) => {
    const equipment = EQUIPMENT_CONFIGS.find(({ id }) => id === equipmentId);
    return sum + (equipment?.baseAttack ?? 10);
  }, 0);

  return Math.max(1, total);
};

export class PlayerCombatRuntime {
  private readonly combat: CombatState;
  private readonly enemyTimeline: EnemyAttackTimeline;
  private runState: RunState;
  private readonly initialization: CombatEncounterInitialization;
  private readonly nextNodeIds: readonly string[];
  private readonly bossNode?: GeneratedMapNode;
  private readonly impactResolver = new SkillImpactResolver();
  private readonly player: SkillCombatantState;
  private readonly enemies = new Map<string, SkillCombatantState>();
  private readonly skillsByActionId = new Map<string, SkillDefinition>();
  private route: CombatOutcomeRoute | null = null;

  constructor(config: PlayerCombatRuntimeConfig) {
    this.combat = config.combat;
    this.enemyTimeline = config.enemyTimeline;
    this.runState = config.runState as RunState;
    this.initialization = config.initialization;
    this.nextNodeIds = config.nextNodeIds ?? [];
    this.bossNode = config.bossNode;
    this.player = new SkillCombatantState({
      id: "player",
      attackPower: resolveAttackPower(config.initialization),
      defense: 0,
      maxHp: config.initialization.player.maxHp,
      initialHp: config.initialization.player.currentHp,
    });

    for (const enemy of config.initialization.enemies) {
      this.enemies.set(
        enemy.instanceId,
        new SkillCombatantState({
          id: enemy.instanceId,
          attackPower: 0,
          defense: 0,
          maxHp: enemy.hp,
          initialHp: enemy.hp,
        }),
      );
    }
  }

  registerAction(actionId: string, skill: SkillDefinition): void {
    this.skillsByActionId.set(actionId, skill);
  }

  setRunState(runState: Readonly<RunState>): void {
    this.runState = runState as RunState;
  }

  get currentRunState(): RunState {
    return this.runState;
  }

  get enemyHp(): Readonly<Record<string, number>> {
    return Object.fromEntries(
      Array.from(this.enemies, ([enemyId, enemy]) => [
        enemyId,
        enemy.snapshot.health.currentHp,
      ]),
    );
  }

  advance(deltaMs: number): PlayerCombatRuntimeUpdate {
    const combatUpdate = this.combat.advance(deltaMs);

    if (this.route === null) {
      for (const event of combatUpdate.events) {
        if (event.type !== "impact-resolved") continue;
        const skill = this.skillsByActionId.get(event.actionId);
        if (skill === undefined) continue;

        const target = event.targetId === "player"
          ? this.player
          : this.resolveLivingEnemyTarget(event.targetId);
        if (target === undefined) continue;

        this.impactResolver.resolve({
          event: target.id === event.targetId ? event : { ...event, targetId: target.id },
          skill,
          actor: this.player,
          target,
        });
      }

      if (
        this.enemies.size > 0 &&
        Array.from(this.enemies.values()).every((enemy) => enemy.snapshot.health.isDead)
      ) {
        this.route = finalizeCombatOutcome({
          combat: this.combat,
          enemyTimeline: this.enemyTimeline,
          runState: this.runState,
          outcome: "victory",
          nextNodeIds: this.nextNodeIds,
          bossNode: this.bossNode,
          rewardTier:
            this.initialization.rewardPolicy === "standard"
              ? "normal"
              : this.initialization.rewardPolicy,
        });
      }
    }

    return {
      combat: combatUpdate,
      enemyHp: this.enemyHp,
      route: this.route,
    };
  }

  private resolveLivingEnemyTarget(targetId: string): SkillCombatantState | undefined {
    const requestedTarget = this.enemies.get(targetId);
    if (requestedTarget !== undefined && !requestedTarget.snapshot.health.isDead) {
      return requestedTarget;
    }

    return Array.from(this.enemies.values()).find(
      (enemy) => !enemy.snapshot.health.isDead,
    );
  }
}
