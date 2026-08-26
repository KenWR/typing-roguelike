import type { RunState } from "@typing-roguelike/shared";
import { playPlayerHitSound } from "../audio/runtime-audio";
import { ActionPointResource } from "./action-point-resource";
import { finalizeCombatOutcome, type CombatOutcomeRoute } from "./combat-outcome-routing";
import { CombatState } from "./combat-state";
import { ShieldPool } from "./shield-pool";
import type { CombatEncounterInitialization, CombatEnemyInitialization } from "./encounter-initializer";
import { EnemyImpactResolver } from "./enemy-impact-resolver";
import { EnemyAttackTimeline, type EnemyAttackTimelineSnapshot } from "./enemy-attack-timeline";
import { SkillCombatantState } from "./skill-impact-resolver";

export type EnemyCombatRuntimeConfig = Readonly<{
  combat: CombatState;
  enemyTimeline: EnemyAttackTimeline;
  actionPoints?: ActionPointResource;
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
  private readonly initialization: CombatEncounterInitialization;
  private readonly random: () => number;
  private readonly player: SkillCombatantState;
  private readonly impactResolver = new EnemyImpactResolver();
  private readonly shields = new ShieldPool();
  private readonly activeTimelineByEnemy = new Map<string, string>();
  private enemyHp: Readonly<Record<string, number>>;
  private runState: RunState;
  private route: CombatOutcomeRoute | null = null;
  private sequence = 1;

  constructor(config: EnemyCombatRuntimeConfig) {
    this.combat = config.combat;
    this.enemyTimeline = config.enemyTimeline;
    this.actionPoints = config.actionPoints ?? new ActionPointResource();
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
        shields: this.shields,
      });
      if (!result.applied) continue;

      if (action.apDelta !== undefined) this.actionPoints.adjust(action.apDelta);
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
    if (action.kind === "defense" && (action.shieldAmount ?? 0) > 0 && action.windupMs > 0) {
      this.shields.grant({
        id: `${timelineId}:shield`,
        ownerId: enemy.instanceId,
        amount: action.shieldAmount ?? 0,
        durationMs: action.windupMs,
        atMs: this.enemyTimeline.snapshot.elapsedMs,
      });
    }
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
