import type { RunState } from "@typing-roguelike/shared";
import { playPlayerHitSound } from "../audio/runtime-audio";
import { ActionPointResource } from "./action-point-resource";
import {
  CombatApEffectController,
  type CombatEnemyApImpact,
} from "./combat-ap-effects";
import { finalizeCombatOutcome, type CombatOutcomeRoute } from "./combat-outcome-routing";
import { CombatState } from "./combat-state";
import { DefenseWindowTracker } from "./defense-window";
import type { CombatEncounterInitialization, CombatEnemyInitialization } from "./encounter-initializer";
import { EnemyImpactResolver } from "./enemy-impact-resolver";
import { EnemyAttackTimeline, type EnemyAttackTimelineSnapshot } from "./enemy-attack-timeline";
import { SkillCombatantState } from "./skill-impact-resolver";

export type EnemyCombatRuntimeConfig = Readonly<{
  combat: CombatState;
  enemyTimeline: EnemyAttackTimeline;
  actionPoints?: ActionPointResource;
  apEffects?: CombatApEffectController;
  runState: RunState;
  initialization: CombatEncounterInitialization;
  random?: () => number;
}>;

export type EnemyCombatRuntimeUpdate = Readonly<{
  playerHp: number;
  playerAp: number;
  runState: RunState;
  timeline: EnemyAttackTimelineSnapshot;
  route: CombatOutcomeRoute | null;
}>;

const validateRandomValue = (value: number): number => {
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError("Enemy attack random value must be in [0, 1).");
  return value;
};

export class EnemyCombatRuntime {
  private readonly combat: CombatState;
  private readonly enemyTimeline: EnemyAttackTimeline;
  private readonly actionPoints: ActionPointResource;
  private readonly apEffects: CombatApEffectController;
  private readonly initialization: CombatEncounterInitialization;
  private readonly random: () => number;
  private readonly player: SkillCombatantState;
  private readonly impactResolver = new EnemyImpactResolver();
  private readonly defenseWindows = new DefenseWindowTracker();
  private readonly activeTimelineByEnemy = new Map<string, string>();
  private enemyHp: Readonly<Record<string, number>>;
  private runState: RunState;
  private route: CombatOutcomeRoute | null = null;
  private sequence = 1;

  constructor(config: EnemyCombatRuntimeConfig) {
    this.combat = config.combat;
    this.enemyTimeline = config.enemyTimeline;
    this.actionPoints = config.actionPoints ?? config.apEffects?.resource ?? new ActionPointResource();
    this.apEffects = config.apEffects ?? new CombatApEffectController({ actionPoints: this.actionPoints });
    this.initialization = config.initialization;
    this.random = config.random ?? Math.random;
    this.runState = config.runState;
    this.enemyHp = Object.fromEntries(config.initialization.enemies.map((enemy) => [enemy.instanceId, enemy.hp]));
    this.player = new SkillCombatantState({
      id: "player",
      attackPower: 0,
      defense: 0,
      maxHp: config.initialization.player.maxHp,
      initialHp: config.initialization.player.currentHp,
    });
  }

  get currentRunState(): RunState { return this.runState; }
  get playerHp(): number { return this.player.snapshot.health.currentHp; }
  get currentRoute(): CombatOutcomeRoute | null { return this.route; }

  setEnemyHp(enemyHp: Readonly<Record<string, number>>): void { this.enemyHp = { ...enemyHp }; }

  start(): void {
    if (this.combat.snapshot.status !== "active" || this.enemyTimeline.snapshot.status !== "active") return;
    for (const enemy of this.initialization.enemies) this.startNextAttack(enemy);
  }

  advance(deltaMs: number): EnemyCombatRuntimeUpdate {
    if (this.route !== null) return this.snapshot();
    const update = this.enemyTimeline.advance(deltaMs);
    const completedEnemyIds = new Set<string>();

    for (const event of update.events) {
      if (event.type !== "impact-resolved") continue;
      const enemy = this.findEnemy(event.enemyId);
      const action = enemy?.actions.find((candidate) => candidate.id === event.attackId);
      if (enemy === undefined || action === undefined) continue;

      const result = this.impactResolver.resolve({
        event,
        damage: action.damage,
        target: this.player,
        defenseWindows: this.defenseWindows,
        defendedDamageMultiplier: 0.5,
      });
      if (!result.applied) continue;

      const defense = this.defenseWindows.resolveImpact("player", event.atMs);
      const perfect: CombatEnemyApImpact["perfect"] = result.defended
        && defense.window !== null
        && event.atMs - defense.window.startsAtMs <= 300;
      this.apEffects.onEnemyImpact({
        apDelta: action.apDelta,
        defended: result.defended,
        perfect,
      });
      playPlayerHitSound({ defended: result.defended, special: action.kind === "special" });
      completedEnemyIds.add(enemy.instanceId);
      this.activeTimelineByEnemy.delete(enemy.instanceId);
      this.runState = {
        ...this.runState,
        character: { ...this.runState.character, currentHp: this.playerHp },
      };
    }

    if (this.player.snapshot.health.isDead) {
      this.route = finalizeCombatOutcome({ combat: this.combat, enemyTimeline: this.enemyTimeline, runState: this.runState, outcome: "defeat" });
      this.runState = this.route.runState;
      return this.snapshot();
    }

    if (this.combat.snapshot.status === "active" && this.enemyTimeline.snapshot.status === "active") {
      for (const enemyId of completedEnemyIds) {
        if ((this.enemyHp[enemyId] ?? 0) <= 0) continue;
        const enemy = this.findEnemy(enemyId);
        if (enemy !== undefined) this.startNextAttack(enemy);
      }
    }
    return this.snapshot();
  }

  private startNextAttack(enemy: CombatEnemyInitialization): void {
    if ((this.enemyHp[enemy.instanceId] ?? 0) <= 0 || enemy.actions.length === 0) return;
    if (this.activeTimelineByEnemy.has(enemy.instanceId)) return;
    const randomValue = validateRandomValue(this.random());
    const actionIndex = Math.min(Math.floor(randomValue * enemy.actions.length), enemy.actions.length - 1);
    const action = enemy.actions[actionIndex];
    if (action === undefined) return;
    const timelineId = `${enemy.instanceId}:${action.id}:${this.sequence++}`;
    this.enemyTimeline.startAttack({
      timelineId,
      enemyId: enemy.instanceId,
      targetId: "player",
      attackId: action.id,
      attackName: action.name,
      attackType: action.kind === "defense" ? "defense" : "attack",
      windupMs: action.windupMs,
      recoveryMs: action.recoveryMs,
    });
    this.activeTimelineByEnemy.set(enemy.instanceId, timelineId);
  }

  private findEnemy(instanceId: string): CombatEnemyInitialization | undefined {
    return this.initialization.enemies.find((enemy) => enemy.instanceId === instanceId);
  }

  private snapshot(): EnemyCombatRuntimeUpdate {
    return {
      playerHp: this.playerHp,
      playerAp: this.actionPoints.snapshot.currentAp,
      runState: this.runState,
      timeline: this.enemyTimeline.snapshot,
      route: this.route,
    };
  }
}
