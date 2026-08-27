/**
 * 실드는 커맨드를 완성하는 순간(플레이어) 또는 선딜이 시작되는 순간(적) 부여되는
 * 피해 흡수량입니다. 남은 실드량만큼 피해를 대신 받아내고, 지속 시간이 끝나면
 * 남은 양과 함께 사라집니다.
 */
export type ShieldInstance = Readonly<{
  id: string;
  ownerId: string;
  /** 남은 흡수량 */
  amount: number;
  /** 부여될 때의 흡수량 */
  maxAmount: number;
  startsAtMs: number;
  endsAtMs: number;
}>;

export type ShieldGrant = Readonly<{
  id: string;
  ownerId: string;
  amount: number;
  durationMs: number;
  atMs: number;
}>;

export type ShieldAbsorbResult = Readonly<{
  ownerId: string;
  incomingDamage: number;
  absorbedDamage: number;
  /** 실드가 흡수하고 남아 HP로 넘어가는 피해 */
  remainingDamage: number;
  absorbed: boolean;
  /** 실드만으로 피해를 전부 받아냈는지 여부 */
  fullyAbsorbed: boolean;
  /** 이 피해로 모두 소진된 실드 id 목록 */
  brokenShieldIds: readonly string[];
  remainingShield: number;
}>;

type MutableShield = {
  readonly id: string;
  readonly ownerId: string;
  readonly maxAmount: number;
  readonly startsAtMs: number;
  readonly endsAtMs: number;
  amount: number;
};

const requireIdentifier = (name: string, value: string): string => {
  if (value.trim().length === 0) throw new RangeError(`${name} must not be empty.`);
  return value;
};

const requireNonNegative = (name: string, value: number): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number.`);
  }
  return value;
};

const toInstance = (shield: MutableShield): ShieldInstance => ({
  id: shield.id,
  ownerId: shield.ownerId,
  amount: shield.amount,
  maxAmount: shield.maxAmount,
  startsAtMs: shield.startsAtMs,
  endsAtMs: shield.endsAtMs,
});

/**
 * 실드가 유효한 구간은 `[startsAtMs, endsAtMs)`입니다. 적의 실드는 선딜 길이만큼
 * 유지되므로, 선딜이 끝나는 그 순간에는 이미 사라진 것으로 계산합니다.
 */
const isActive = (shield: MutableShield, atMs: number): boolean =>
  shield.amount > 0 && atMs >= shield.startsAtMs && atMs < shield.endsAtMs;

export class ShieldPool {
  private readonly shields = new Map<string, MutableShield>();

  grant(grant: ShieldGrant): ShieldInstance {
    const id = requireIdentifier("Shield id", grant.id);
    if (this.shields.has(id)) throw new Error(`Shield id already exists: ${id}`);

    const startsAtMs = requireNonNegative("Shield start", grant.atMs);
    const shield: MutableShield = {
      id,
      ownerId: requireIdentifier("Shield owner id", grant.ownerId),
      amount: requireNonNegative("Shield amount", grant.amount),
      maxAmount: requireNonNegative("Shield amount", grant.amount),
      startsAtMs,
      endsAtMs: startsAtMs + requireNonNegative("Shield duration", grant.durationMs),
    };
    this.shields.set(id, shield);
    return toInstance(shield);
  }

  release(id: string): boolean {
    return this.shields.delete(requireIdentifier("Shield id", id));
  }

  releaseOwner(ownerId: string): void {
    const owner = requireIdentifier("Shield owner id", ownerId);
    for (const [id, shield] of this.shields) {
      if (shield.ownerId === owner) this.shields.delete(id);
    }
  }

  get(id: string): ShieldInstance | undefined {
    const shield = this.shields.get(id);
    return shield === undefined ? undefined : toInstance(shield);
  }

  activeShields(ownerId: string, atMs: number): readonly ShieldInstance[] {
    const owner = requireIdentifier("Shield owner id", ownerId);
    const at = requireNonNegative("Shield query time", atMs);
    return this.sortByExpiry(
      Array.from(this.shields.values()).filter(
        (shield) => shield.ownerId === owner && isActive(shield, at),
      ),
    ).map(toInstance);
  }

  totalAmount(ownerId: string, atMs: number): number {
    return this.activeShields(ownerId, atMs).reduce(
      (total, shield) => total + shield.amount,
      0,
    );
  }

  /** 가장 먼저 만료되는 실드부터 소모하면서 피해를 흡수합니다. */
  absorb(ownerId: string, damage: number, atMs: number): ShieldAbsorbResult {
    const owner = requireIdentifier("Shield owner id", ownerId);
    const incomingDamage = requireNonNegative("Shield incoming damage", damage);
    const at = requireNonNegative("Shield absorb time", atMs);

    const active = this.sortByExpiry(
      Array.from(this.shields.values()).filter(
        (shield) => shield.ownerId === owner && isActive(shield, at),
      ),
    );

    let remainingDamage = incomingDamage;
    let absorbedDamage = 0;
    const brokenShieldIds: string[] = [];

    for (const shield of active) {
      if (remainingDamage <= 0) break;
      const consumed = Math.min(shield.amount, remainingDamage);
      shield.amount -= consumed;
      remainingDamage -= consumed;
      absorbedDamage += consumed;
      if (shield.amount === 0) {
        brokenShieldIds.push(shield.id);
        this.shields.delete(shield.id);
      }
    }

    return {
      ownerId: owner,
      incomingDamage,
      absorbedDamage,
      remainingDamage,
      absorbed: absorbedDamage > 0,
      fullyAbsorbed: absorbedDamage > 0 && remainingDamage === 0,
      brokenShieldIds,
      remainingShield: this.totalAmount(owner, at),
    };
  }

  pruneExpired(atMs: number): void {
    const cutoff = requireNonNegative("Shield prune time", atMs);
    for (const [id, shield] of this.shields) {
      if (shield.endsAtMs <= cutoff || shield.amount === 0) this.shields.delete(id);
    }
  }

  private sortByExpiry(shields: readonly MutableShield[]): MutableShield[] {
    return [...shields].sort(
      (left, right) => left.endsAtMs - right.endsAtMs || left.startsAtMs - right.startsAtMs,
    );
  }
}
