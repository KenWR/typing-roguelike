import type { RunState } from "@typing-roguelike/shared";
import {
  finalizeCombatOutcome,
  type CombatOutcomeRoute,
} from "./combat-outcome-routing";
import { CombatState } from "./combat-state";
import { EnemyAttackTimeline } from "./enemy-attack-timeline";
import {
  HealthState,
  type DamageResult,
  type HealthStateConfig,
  type HealthSnapshot,
} from "./health-state";

export type CombatDefeatDamageResult = Readonly<{
  accepted: boolean;
  damage: DamageResult | null;
  playerHealth: HealthSnapshot;
  route: CombatOutcomeRoute | null;
}>;

export type CombatDefeatResolverConfig = Readonly<{
  runState: RunState;
  playerHealth?: HealthStateConfig;
  combat?: CombatState;
  enemyTimeline?: EnemyAttackTimeline;
}>;

export class CombatDefeatResolver {
  private readonly playerHealth: HealthState;
  private readonly combat: CombatState;
  private readonly enemyTimeline: EnemyAttackTimeline;
  private runState: RunState;
  private defeatRoute: CombatOutcomeRoute | null = null;

  constructor({
    runState,
    playerHealth,
    combat = new CombatState(),
    enemyTimeline = new EnemyAttackTimeline(),
  }: CombatDefeatResolverConfig) {
    this.runState = runState;
    this.playerHealth = new HealthState(playerHealth);
    this.combat = combat;
    this.enemyTimeline = enemyTimeline;
  }

  get currentRunState(): RunState {
    return this.runState;
  }

  get healthSnapshot(): HealthSnapshot {
    return this.playerHealth.snapshot;
  }

  get route(): CombatOutcomeRoute | null {
    return this.defeatRoute;
  }

  applyDamage(damage: number): CombatDefeatDamageResult {
    if (this.combat.snapshot.status !== "active") {
      return {
        accepted: false,
        damage: null,
        playerHealth: this.playerHealth.snapshot,
        route: this.defeatRoute,
      };
    }

    const damageResult = this.playerHealth.applyDamage(damage);

    if (damageResult.deathOccurred) {
      this.defeatRoute = finalizeCombatOutcome({
        combat: this.combat,
        enemyTimeline: this.enemyTimeline,
        runState: this.runState,
        outcome: "defeat",
      });
      this.runState = this.defeatRoute.runState;
    }

    return {
      accepted: true,
      damage: damageResult,
      playerHealth: this.playerHealth.snapshot,
      route: this.defeatRoute,
    };
  }
}
