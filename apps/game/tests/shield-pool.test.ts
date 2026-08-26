import { describe, expect, test } from "bun:test";
import { ShieldPool } from "../src/game/combat/shield-pool";

const grant = (
  pool: ShieldPool,
  overrides: Partial<Parameters<ShieldPool["grant"]>[0]> = {},
) =>
  pool.grant({
    id: "shield-1",
    ownerId: "player",
    amount: 20,
    durationMs: 1_000,
    atMs: 0,
    ...overrides,
  });

describe("shield pool", () => {
  test("is active from the moment it is granted", () => {
    const pool = new ShieldPool();
    grant(pool, { atMs: 500 });

    expect(pool.totalAmount("player", 499)).toBe(0);
    expect(pool.totalAmount("player", 500)).toBe(20);
    expect(pool.totalAmount("player", 1_499)).toBe(20);
  });

  test("is gone the instant its duration ends", () => {
    const pool = new ShieldPool();
    grant(pool, { atMs: 0, durationMs: 800 });

    expect(pool.totalAmount("player", 799)).toBe(20);
    expect(pool.totalAmount("player", 800)).toBe(0);
    expect(pool.absorb("player", 10, 800).absorbedDamage).toBe(0);
  });

  test("absorbs damage up to its remaining amount and passes the rest through", () => {
    const pool = new ShieldPool();
    grant(pool, { amount: 12 });

    const partial = pool.absorb("player", 5, 100);
    expect(partial).toMatchObject({
      absorbedDamage: 5,
      remainingDamage: 0,
      fullyAbsorbed: true,
      brokenShieldIds: [],
      remainingShield: 7,
    });

    const breaking = pool.absorb("player", 20, 200);
    expect(breaking).toMatchObject({
      absorbedDamage: 7,
      remainingDamage: 13,
      fullyAbsorbed: false,
      brokenShieldIds: ["shield-1"],
      remainingShield: 0,
    });
  });

  test("spends the shield that expires first when several overlap", () => {
    const pool = new ShieldPool();
    grant(pool, { id: "long", amount: 10, durationMs: 4_000 });
    grant(pool, { id: "short", amount: 10, durationMs: 500 });

    const result = pool.absorb("player", 12, 100);

    expect(result.brokenShieldIds).toEqual(["short"]);
    expect(pool.get("long")?.amount).toBe(8);
  });

  test("keeps each owner's shields separate", () => {
    const pool = new ShieldPool();
    grant(pool, { id: "player-shield", ownerId: "player", amount: 20 });
    grant(pool, { id: "enemy-shield", ownerId: "enemy:1", amount: 30 });

    expect(pool.absorb("enemy:1", 40, 10).absorbedDamage).toBe(30);
    expect(pool.totalAmount("player", 10)).toBe(20);
  });

  test("releases a shield by id and drops expired ones on prune", () => {
    const pool = new ShieldPool();
    grant(pool, { id: "windup", durationMs: 600 });

    pool.pruneExpired(500);
    expect(pool.get("windup")).toBeDefined();

    pool.pruneExpired(600);
    expect(pool.get("windup")).toBeUndefined();

    grant(pool, { id: "manual" });
    expect(pool.release("manual")).toBe(true);
    expect(pool.release("manual")).toBe(false);
  });

  test("rejects duplicate ids and invalid values", () => {
    const pool = new ShieldPool();
    grant(pool);

    expect(() => grant(pool)).toThrow();
    expect(() => grant(pool, { id: "bad", amount: -1 })).toThrow(RangeError);
    expect(() => grant(pool, { id: "  " })).toThrow(RangeError);
  });
});
