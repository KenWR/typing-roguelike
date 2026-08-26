import { CombatState, type CombatSnapshot } from "./combat-state";
import { HealthState, type DamageResult, type HealthSnapshot } from "./health-state";

export type CombatEnemyHealthConfig = Readonly<{
  enemyId: string;
  maxHp: number;
  initialHp?: number;
}>;

export type CombatVictoryEvent = Readonly<{
  type: "reward-ready";
}>;

export type CombatVictorySnapshot = Readonly<{
  combat: CombatSnapshot;
  enemies: Readonly<Record<string, HealthSnapshot>>;
}>;

export type CombatVictoryDamageResult = Readonly<{
  accepted: boolean;
  damage: DamageResult | null;
  snapshot: CombatVictorySnapshot;
  events: readonly CombatVictoryEvent[];
}>;

export class CombatVictoryResolver {
  private readonly combat = new CombatState();
  private readonly enemies = new Map<string, HealthState>();
  private rewardEventEmitted = false;

  constructor(enemyConfigs: readonly CombatEnemyHealthConfig[]) {
    if (enemyConfigs.length === 0) {
      throw new RangeError("Combat requires at least one enemy.");
    }

    for (const enemy of enemyConfigs) {
      if (enemy.enemyId.trim().length === 0) {
        throw new RangeError("Enemy id must not be empty.");
      }
      if (this.enemies.has(enemy.enemyId)) {
        throw new Error(`Duplicate enemy id: ${enemy.enemyId}`);
      }
      this.enemies.set(
        enemy.enemyId,
        new HealthState({ maxHp: enemy.maxHp, initialHp: enemy.initialHp }),
      );
    }
  }

  get snapshot(): CombatVictorySnapshot {
    return {
      combat: this.combat.snapshot,
      enemies: Object.fromEntries(
        Array.from(this.enemies, ([enemyId, health]) => [enemyId, health.snapshot]),
      ),
    };
  }

  applyDamage(enemyId: string, damage: number): CombatVictoryDamageResult {
    if (!this.combat.snapshot.canAcceptInput) {
      return {
        accepted: false,
        damage: null,
        snapshot: this.snapshot,
        events: [],
      };
    }

    const health = this.enemies.get(enemyId);
    if (health === undefined) {
      throw new Error(`Unknown combat enemy: ${enemyId}`);
    }

    const damageResult = health.applyDamage(damage);
    const events: CombatVictoryEvent[] = [];
    const allEnemiesDead = Array.from(this.enemies.values()).every(
      (enemyHealth) => enemyHealth.snapshot.isDead,
    );

    if (allEnemiesDead) {
      this.combat.finish("victory");
      if (!this.rewardEventEmitted) {
        this.rewardEventEmitted = true;
        events.push({ type: "reward-ready" });
      }
    }

    return {
      accepted: true,
      damage: damageResult,
      snapshot: this.snapshot,
      events,
    };
  }
}
