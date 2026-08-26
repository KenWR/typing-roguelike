import {
  EQUIPMENT_CONFIGS,
  type GeneratedMapNode,
  type RunState,
  type SkillDefinition,
} from "@typing-roguelike/shared";
import {
  playPlayerHitSound,
  playRuntimeBgm,
  playWeaponImpactSound,
} from "../audio/runtime-audio";
import type {
  CombatEnemyInitialization,
  CombatEncounterInitialization,
} from "./encounter-initializer";
import { CombatState, type CombatUpdate } from "./combat-state";
import { DefenseWindowTracker } from "./defense-window";
import {
  EnemyAttackTimeline,
  type EnemyAttackEvent,
  type EnemyAttackTimelineUpdate,
} from "./enemy-attack-timeline";
import { EnemyImpactResolver } from "./enemy-impact-resolver";
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
  random?: () => number;
}>;

export type PlayerCombatRuntimeUpdate = Readonly<{
  combat: CombatUpdate;
  enemyTimeline: EnemyAttackTimelineUpdate;
  playerHp: number;
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

const validateRandomValue = (value: number): number => {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("Enemy attack random value must be in [0, 1).");
  }

  return value;
};

export class PlayerCombatRuntime {
  private readonly combat: CombatState;
  private readonly enemyTimeline: EnemyAttackTimeline;
  private runState: RunState;
  private readonly initialization: CombatEncounterInitialization;
  private readonly nextNodeIds: readonly string[];
  private readonly bossNode?: GeneratedMapNode;
  private readonly random: () => number;
  private readonly impactResolver = new SkillImpactResolver();
  private readonly enemyImpactResolver = new EnemyImpactResolver();
  private readonly defenseWindows = new DefenseWindowTracker();
  private readonly defenseMultiplierByWindowId = new Map<string, number>();
  private readonly player: SkillCombatantState;
  private readonly enemies = new Map<string, SkillCombatantState>();
  private readonly skillsByActionId = new Map<string, SkillDefinition>();
  private route: CombatOutcomeRoute | null = null;
  private nextEnemyTimelineSequence = 1;

  constructor(config: PlayerCombatRuntimeConfig) {
    this.combat = config.combat;
    this.enemyTimeline = config.enemyTimeline;
    this.runState = config.runState as RunState;
    this.initialization = config.initialization;
    this.nextNodeIds = config.nextNodeIds ?? [];
    this.bossNode = config.bossNode;
    this.random = config.random ?? Math.random;
    playRuntimeBgm(config.initialization.nodeType === "boss" ? "boss" : "tower");
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

  start(): void {
    if (
      this.route !== null ||
      this.combat.snapshot.status !== "active" ||
      this.enemyTimeline.snapshot.status !== "active"
    ) {
      return;
    }

    for (const enemy of this.initialization.enemies) {
      this.startNextEnemyAttack(enemy.instanceId);
    }
  }

  registerAction(actionId: string, skill: SkillDefinition): void {
    if (this.route !== null) return;
    this.skillsByActionId.set(actionId, skill);
  }

  setRunState(runState: Readonly<RunState>): void {
    if (this.route !== null) return;
    this.runState = runState as RunState;
  }

  get currentRunState(): RunState {
    return this.runState;
  }

  get playerHp(): number {
    return this.player.snapshot.health.currentHp;
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
    const enemyTimelineUpdate = this.enemyTimeline.advance(deltaMs);

    if (this.route === null) {
      this.resolvePlayerImpacts(combatUpdate);
      this.resolveOutcome();

      if (this.route === null) {
        this.resolveEnemyImpacts(enemyTimelineUpdate.events);
        this.resolveOutcome();
      }
    }

    return {
      combat: this.route === null ? combatUpdate : this.combat.advance(0),
      enemyTimeline:
        this.route === null
          ? enemyTimelineUpdate
          : this.enemyTimeline.advance(0),
      playerHp: this.playerHp,
      enemyHp: this.enemyHp,
      route: this.route,
    };
  }

  private resolvePlayerImpacts(combatUpdate: CombatUpdate): void {
    for (const event of combatUpdate.events) {
      if (event.type !== "impact-resolved") continue;
      const skill = this.skillsByActionId.get(event.actionId);
      if (skill === undefined) continue;

      const target = event.targetId === "player"
        ? this.player
        : this.resolveLivingEnemyTarget(event.targetId);
      if (target === undefined) continue;

      const impactEvent = target.id === event.targetId
        ? event
        : { ...event, targetId: target.id };
      const result = this.impactResolver.resolve({
        event: impactEvent,
        skill,
        actor: this.player,
        target,
      });
      if (!result.applied) continue;

      if (result.damageApplied > 0 && target.id !== this.player.id) {
        playWeaponImpactSound(this.initialization.player.equipmentIds);
      }

      for (const [index, effect] of skill.effects.entries()) {
        if (effect.type !== "guard") continue;
        const windowId = `${event.actionId}:guard:${index}`;
        this.defenseWindows.openWindow(
          windowId,
          this.player.id,
          event.atMs,
          effect.durationMs,
        );
        this.defenseMultiplierByWindowId.set(windowId, effect.damageMultiplier);
      }
    }
  }

  private resolveEnemyImpacts(events: readonly EnemyAttackEvent[]): void {
    for (const event of events) {
      if (event.type !== "impact-resolved" || event.targetId !== this.player.id) {
        continue;
      }

      const enemyState = this.enemies.get(event.enemyId);
      if (enemyState === undefined || enemyState.snapshot.health.isDead) {
        continue;
      }

      const enemy = this.findEnemy(event.enemyId);
      const action = enemy?.actions.find(
        (candidate) => candidate.id === event.attackId,
      );
      if (enemy === undefined || action === undefined) continue;

      const defense = this.defenseWindows.resolveImpact(this.player.id, event.atMs);
      const defendedDamageMultiplier = defense.window === null
        ? 1
        : (this.defenseMultiplierByWindowId.get(defense.window.id) ?? 1);
      const result = this.enemyImpactResolver.resolve({
        event,
        damage: action.damage,
        target: this.player,
        defenseWindows: this.defenseWindows,
        defendedDamageMultiplier,
      });
      if (!result.applied) continue;

      playPlayerHitSound({
        defended: result.defended,
        special: action.kind === "special",
      });
      this.runState = {
        ...this.runState,
        character: {
          ...this.runState.character,
          currentHp: this.playerHp,
        },
      };

      if (!this.player.snapshot.health.isDead) {
        this.startNextEnemyAttack(enemy.instanceId);
      }
    }

    this.defenseWindows.pruneExpired(this.enemyTimeline.snapshot.elapsedMs);
  }

  private startNextEnemyAttack(enemyId: string): void {
    if (
      this.route !== null ||
      this.combat.snapshot.status !== "active" ||
      this.enemyTimeline.snapshot.status !== "active"
    ) {
      return;
    }

    const enemyState = this.enemies.get(enemyId);
    if (enemyState?.snapshot.health.isDead !== false) return;

    const enemy = this.findEnemy(enemyId);
    if (enemy === undefined || enemy.actions.length === 0) return;

    const hasActiveAttack = this.enemyTimeline.snapshot.attacks.some(
      (attack) => attack.enemyId === enemyId && !attack.impactResolved,
    );
    if (hasActiveAttack) return;

    const randomValue = validateRandomValue(this.random());
    const actionIndex = Math.min(
      Math.floor(randomValue * enemy.actions.length),
      enemy.actions.length - 1,
    );
    const action = enemy.actions[actionIndex];
    if (action === undefined) return;

    this.enemyTimeline.startAttack({
      timelineId: `${enemy.instanceId}:${action.id}:runtime:${this.nextEnemyTimelineSequence++}`,
      enemyId: enemy.instanceId,
      targetId: this.player.id,
      attackId: action.id,
      attackName: action.name,
      attackType: action.kind === "defense" ? "defense" : "attack",
      windupMs: action.windupMs,
      recoveryMs: action.recoveryMs,
    });
  }

  private findEnemy(instanceId: string): CombatEnemyInitialization | undefined {
    return this.initialization.enemies.find(
      (enemy) => enemy.instanceId === instanceId,
    );
  }

  private resolveLivingEnemyTarget(
    targetId: string,
  ): SkillCombatantState | undefined {
    const requestedTarget = this.enemies.get(targetId);
    if (requestedTarget !== undefined && !requestedTarget.snapshot.health.isDead) {
      return requestedTarget;
    }

    return Array.from(this.enemies.values()).find(
      (enemy) => !enemy.snapshot.health.isDead,
    );
  }

  private resolveOutcome(): void {
    if (this.route !== null) return;

    if (this.player.snapshot.health.isDead) {
      this.route = this.finalize("defeat");
      return;
    }

    if (
      this.enemies.size > 0 &&
      Array.from(this.enemies.values()).every(
        (enemy) => enemy.snapshot.health.isDead,
      )
    ) {
      this.route = this.finalize("victory");
    }
  }

  private finalize(outcome: "victory" | "defeat"): CombatOutcomeRoute {
    const route = finalizeCombatOutcome({
      combat: this.combat,
      enemyTimeline: this.enemyTimeline,
      runState: this.runState,
      outcome,
      nextNodeIds: this.nextNodeIds,
      bossNode: this.bossNode,
      rewardTier:
        this.initialization.rewardPolicy === "standard"
          ? "normal"
          : this.initialization.rewardPolicy,
    });
    this.runState = route.runState;
    return route;
  }
}
