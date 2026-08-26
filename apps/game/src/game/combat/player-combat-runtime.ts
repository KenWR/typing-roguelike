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
import { ActionPointResource } from "./action-point-resource";
import { CombatApEffectController } from "./combat-ap-effects";
import type {
  CombatEnemyInitialization,
  CombatEncounterInitialization,
} from "./encounter-initializer";
import { CombatState, type CombatUpdate } from "./combat-state";
import { ShieldPool } from "./shield-pool";
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
  actionPoints?: ActionPointResource;
  apEffects?: CombatApEffectController;
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
  playerAp: number;
  enemyHp: Readonly<Record<string, number>>;
  playerShield: number;
  enemyShield: Readonly<Record<string, number>>;
  route: CombatOutcomeRoute | null;
}>;

type PlayerImpactEvent = CombatUpdate["events"][number];
type ResolvedEnemyImpactEvent = EnemyAttackEvent;
type OrderedRuntimeImpact =
  | Readonly<{
      source: "player";
      event: PlayerImpactEvent;
      priority: 1;
      sequence: number;
    }>
  | Readonly<{
      source: "enemy";
      event: ResolvedEnemyImpactEvent;
      priority: 0 | 2;
      sequence: number;
    }>;

const resolveAttackPower = (
  initialization: CombatEncounterInitialization,
): number => {
  const total = initialization.player.equipmentIds.reduce((sum, equipmentId) => {
    const equipment = EQUIPMENT_CONFIGS.find(({ id }) => id === equipmentId);
    return sum + (equipment?.baseAttack ?? 0);
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
  private readonly actionPoints: ActionPointResource;
  private readonly apEffects: CombatApEffectController;
  private runState: RunState;
  private readonly initialization: CombatEncounterInitialization;
  private readonly nextNodeIds: readonly string[];
  private readonly bossNode?: GeneratedMapNode;
  private readonly random: () => number;
  private readonly impactResolver = new SkillImpactResolver();
  private readonly enemyImpactResolver = new EnemyImpactResolver();
  private readonly shields = new ShieldPool();
  private readonly enemyTimelineByShieldId = new Map<string, string>();
  private readonly enemyShieldIdByTimelineId = new Map<string, string>();
  private readonly player: SkillCombatantState;
  private readonly enemies = new Map<string, SkillCombatantState>();
  private readonly skillsByActionId = new Map<
    string,
    Readonly<{ skill: SkillDefinition; damageMultiplier: number }>
  >();
  private route: CombatOutcomeRoute | null = null;
  private nextEnemyTimelineSequence = 1;

  constructor(config: PlayerCombatRuntimeConfig) {
    this.combat = config.combat;
    this.enemyTimeline = config.enemyTimeline;
    this.actionPoints = config.actionPoints ?? new ActionPointResource();
    this.apEffects = config.apEffects ?? new CombatApEffectController({ actionPoints: this.actionPoints });
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

  /**
   * 커맨드가 완성된 순간 호출됩니다. 스킬의 실드는 선딜을 기다리지 않고
   * 이 시점에 즉시 부여됩니다.
   */
  registerAction(
    actionId: string,
    skill: SkillDefinition,
    damageMultiplier = 1,
  ): void {
    if (this.route !== null) return;
    this.skillsByActionId.set(actionId, { skill, damageMultiplier });
    this.grantSkillShields(actionId, skill);
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

  /** 커맨드 완성으로 얻어 아직 남아 있는 플레이어 실드량입니다. */
  get playerShield(): number {
    return this.shields.totalAmount(this.player.id, this.elapsedMs);
  }

  /** 선딜 중이라 실드가 차 있는 적들의 남은 실드량입니다. */
  get enemyShield(): Readonly<Record<string, number>> {
    const atMs = this.elapsedMs;
    return Object.fromEntries(
      Array.from(this.enemies.keys(), (enemyId) => [
        enemyId,
        this.shields.totalAmount(enemyId, atMs),
      ]),
    );
  }

  private get elapsedMs(): number {
    return this.enemyTimeline.snapshot.elapsedMs;
  }

  advance(deltaMs: number): PlayerCombatRuntimeUpdate {
    const combatUpdate = this.combat.advance(deltaMs);
    const enemyTimelineUpdate = this.enemyTimeline.advance(deltaMs);

    if (this.route === null) {
      this.releaseFinishedWindupShields(enemyTimelineUpdate.snapshot);
      this.resolveImpactsChronologically(
        combatUpdate,
        enemyTimelineUpdate.events,
      );
    }

    return {
      combat: this.route === null ? combatUpdate : this.combat.advance(0),
      enemyTimeline:
        this.route === null
          ? enemyTimelineUpdate
          : this.enemyTimeline.advance(0),
      playerHp: this.playerHp,
      playerAp: this.actionPoints.snapshot.currentAp,
      enemyHp: this.enemyHp,
      playerShield: this.playerShield,
      enemyShield: this.enemyShield,
      route: this.route,
    };
  }

  private resolveImpactsChronologically(
    combatUpdate: CombatUpdate,
    enemyEvents: readonly EnemyAttackEvent[],
  ): void {
    const playerImpacts: OrderedRuntimeImpact[] = combatUpdate.events
      .filter((event) => event.type === "impact-resolved")
      .map((event, sequence) => ({
        source: "player",
        event,
        priority: 1,
        sequence,
      }));
    const enemyImpacts: OrderedRuntimeImpact[] = enemyEvents
      .filter((event) => event.type === "impact-resolved")
      .map((event, sequence) => ({
        source: "enemy",
        event,
        priority: this.isEnemyDefenseImpact(event) ? 0 : 2,
        sequence: playerImpacts.length + sequence,
      }));
    const orderedImpacts = [...playerImpacts, ...enemyImpacts].sort(
      (left, right) =>
        left.event.atMs - right.event.atMs ||
        left.priority - right.priority ||
        left.sequence - right.sequence,
    );

    for (const impact of orderedImpacts) {
      if (impact.source === "player") {
        this.resolvePlayerImpact(impact.event);
      } else {
        this.resolveEnemyImpact(impact.event);
      }
      this.resolveOutcome();
      if (this.route !== null) break;
    }

    if (orderedImpacts.length === 0) this.resolveOutcome();
    this.shields.pruneExpired(this.elapsedMs);
  }

  /** 선딜이 끝나는 순간 적의 실드는 남은 양과 상관없이 사라집니다. */
  private releaseFinishedWindupShields(
    timeline: Readonly<EnemyAttackTimeline["snapshot"]>,
  ): void {
    const activeWindupTimelineIds = new Set(
      timeline.attacks
        .filter((attack) => attack.phase === "windup")
        .map((attack) => attack.timelineId),
    );

    for (const timelineId of this.enemyShieldIdByTimelineId.keys()) {
      if (!activeWindupTimelineIds.has(timelineId)) {
        this.releaseEnemyShield(timelineId);
      }
    }
  }

  private releaseEnemyShield(timelineId: string): void {
    const shieldId = this.enemyShieldIdByTimelineId.get(timelineId);
    if (shieldId === undefined) return;
    this.enemyShieldIdByTimelineId.delete(timelineId);
    this.enemyTimelineByShieldId.delete(shieldId);
    this.shields.release(shieldId);
  }

  private resolvePlayerImpact(event: PlayerImpactEvent): void {
    const entry = this.skillsByActionId.get(event.actionId);
    if (entry === undefined) return;
    const { skill, damageMultiplier } = entry;

    const target = event.targetId === "player"
      ? this.player
      : this.resolveLivingEnemyTarget(event.targetId);
    if (target === undefined) return;

    const impactEvent = target.id === event.targetId
      ? event
      : { ...event, targetId: target.id };
    const result = this.impactResolver.resolve({
      event: impactEvent,
      skill,
      actor: this.player,
      target,
      shields: this.shields,
      damageMultiplier,
    });
    if (!result.applied) return;

    this.apEffects.onSkillImpact(skill);

    if (
      target.id !== this.player.id &&
      (result.damageApplied > 0 || result.shieldAbsorbedDamage > 0)
    ) {
      playWeaponImpactSound(this.initialization.player.equipmentIds);
    }

    for (const shieldId of result.brokenShieldIds) {
      this.cancelAttackOnBrokenShield(shieldId);
    }
  }

  /**
   * 선딜 중인 적의 실드를 모두 깎으면 그 행동은 취소되고 적은 곧바로 다음
   * 행동을 고릅니다.
   */
  private cancelAttackOnBrokenShield(shieldId: string): void {
    const timelineId = this.enemyTimelineByShieldId.get(shieldId);
    if (timelineId === undefined) return;
    this.enemyTimelineByShieldId.delete(shieldId);
    this.enemyShieldIdByTimelineId.delete(timelineId);

    const attack = this.enemyTimeline.snapshot.attacks.find(
      (candidate) => candidate.timelineId === timelineId,
    );
    if (attack === undefined || attack.phase !== "windup") return;

    this.enemyTimeline.cancelAttack(timelineId);
    this.startNextEnemyAttack(attack.enemyId);
  }

  private resolveEnemyImpact(event: ResolvedEnemyImpactEvent): void {
    if (event.targetId !== this.player.id) return;

    const enemyState = this.enemies.get(event.enemyId);
    if (enemyState === undefined || enemyState.snapshot.health.isDead) return;

    const enemy = this.findEnemy(event.enemyId);
    const action = enemy?.actions.find(
      (candidate) => candidate.id === event.attackId,
    );
    if (enemy === undefined || action === undefined) return;

    if (action.kind === "defense") {
      this.startNextEnemyAttack(enemy.instanceId);
      return;
    }

    const result = this.enemyImpactResolver.resolve({
      event,
      damage: action.damage,
      target: this.player,
      shields: this.shields,
    });
    if (!result.applied) return;

    if (action.apDelta !== undefined) {
      this.actionPoints.adjust(action.apDelta);
    }

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

  private isEnemyDefenseImpact(event: ResolvedEnemyImpactEvent): boolean {
    return this.findEnemy(event.enemyId)?.actions.some(
      (action) => action.id === event.attackId && action.kind === "defense",
    ) ?? false;
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

    const timelineId = `${enemy.instanceId}:${action.id}:runtime:${this.nextEnemyTimelineSequence++}`;
    this.enemyTimeline.startAttack({
      timelineId,
      enemyId: enemy.instanceId,
      targetId: this.player.id,
      attackId: action.id,
      attackName: action.name,
      attackType: action.kind === "defense" ? "defense" : "attack",
      windupMs: action.windupMs,
      recoveryMs: action.recoveryMs,
    });
    this.grantEnemyWindupShield(timelineId, enemy.instanceId, action);
  }

  /** 적은 선딜이 시작되는 순간 실드가 가득 찬 상태로 행동을 시작합니다. */
  private grantEnemyWindupShield(
    timelineId: string,
    enemyId: string,
    action: CombatEnemyInitialization["actions"][number],
  ): void {
    if (action.kind !== "defense") return;
    const amount = action.shieldAmount ?? 0;
    if (amount <= 0 || action.windupMs <= 0) return;

    const shieldId = `${timelineId}:shield`;
    this.shields.grant({
      id: shieldId,
      ownerId: enemyId,
      amount,
      durationMs: action.windupMs,
      atMs: this.elapsedMs,
    });
    this.enemyTimelineByShieldId.set(shieldId, timelineId);
    this.enemyShieldIdByTimelineId.set(timelineId, shieldId);
  }

  /** 커맨드를 완성한 순간 스킬의 실드를 즉시 부여합니다. */
  private grantSkillShields(actionId: string, skill: SkillDefinition): void {
    const atMs = this.elapsedMs;
    skill.effects.forEach((effect, index) => {
      if (effect.type !== "shield") return;
      const amount = this.apEffects.resolveShieldAmount(effect.amount);
      const durationMs = this.apEffects.resolveShieldDuration(effect.durationMs);
      if (amount <= 0 || durationMs <= 0) return;
      this.shields.grant({
        id: `${actionId}:shield:${index}`,
        ownerId: this.player.id,
        amount,
        durationMs,
        atMs,
      });
      this.apEffects.onShieldGranted();
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
