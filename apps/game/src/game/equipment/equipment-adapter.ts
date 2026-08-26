export const EQUIPMENT_SLOTS = [
  "weapon",
  "offhand",
  "ring-1",
  "ring-2",
] as const;

export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];

export const EQUIPMENT_SLOT_LABELS: Readonly<Record<EquipmentSlot, string>> = {
  weapon: "무기",
  offhand: "보조무기",
  "ring-1": "반지 I",
  "ring-2": "반지 II",
};

export type EquipmentRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

export const EQUIPMENT_RARITY_LABELS: Readonly<
  Record<EquipmentRarity, string>
> = {
  common: "COMMON",
  uncommon: "UNCOMMON",
  rare: "RARE",
  epic: "EPIC",
  legendary: "LEGENDARY",
};

export const EQUIPMENT_RARITY_COLORS: Readonly<
  Record<EquipmentRarity, number>
> = {
  common: 0x94a3b8,
  uncommon: 0x5eead4,
  rare: 0x60a5fa,
  epic: 0xc084fc,
  legendary: 0xf6c85f,
};

export type EquipmentSkill = Readonly<{
  id: string;
  name: string;
  command: string;
  summary: string;
}>;

export type EquipmentDefinition = Readonly<{
  id: string;
  slot: EquipmentSlot;
  name: string;
  rarity: EquipmentRarity;
  iconPath: string;
  passive: string;
  skills: readonly EquipmentSkill[];
}>;

export type EquipmentSnapshot = Readonly<{
  equippedBySlot: Readonly<Record<EquipmentSlot, string>>;
  ownedEquipment: readonly EquipmentDefinition[];
}>;

export interface EquipmentAdapter {
  getSnapshot(): EquipmentSnapshot;
  equip(slot: EquipmentSlot, equipmentId: string): EquipmentSnapshot;
}

const createSnapshot = (snapshot: EquipmentSnapshot): EquipmentSnapshot => ({
  equippedBySlot: { ...snapshot.equippedBySlot },
  ownedEquipment: snapshot.ownedEquipment.map((equipment) => ({
    ...equipment,
    skills: equipment.skills.map((skill) => ({ ...skill })),
  })),
});

export const EQUIPMENT_FIXTURE: EquipmentSnapshot = {
  equippedBySlot: {
    weapon: "weapon-emberline",
    offhand: "offhand-aegis",
    "ring-1": "ring-echoes",
    "ring-2": "ring-sigil",
  },
  ownedEquipment: [
    {
      id: "weapon-emberline",
      slot: "weapon",
      name: "Emberline Saber",
      rarity: "rare",
      iconPath:
        "/assets/images/weapon_icons_pixel/96/sword_rare_duelist_silver.png",
      passive: "화상 상태의 적에게 주는 피해 +12%",
      skills: [
        {
          id: "emberline-slash",
          name: "불꽃 베기",
          command: "불꽃베기",
          summary: "다음 타격에 화상 1 부여",
        },
        {
          id: "emberline-finish",
          name: "잔화 마무리",
          command: "잔화마무리",
          summary: "화상 대상에게 추가 피해",
        },
      ],
    },
    {
      id: "weapon-voidfang",
      slot: "weapon",
      name: "Voidfang Greatsword",
      rarity: "epic",
      iconPath:
        "/assets/images/weapon_icons_pixel/96/sword_epic_infinite_combo.png",
      passive: "연속 입력 3회마다 피해량 증가",
      skills: [
        {
          id: "voidfang-cleave",
          name: "공허 가르기",
          command: "공허가르기",
          summary: "전방의 적에게 높은 피해",
        },
        {
          id: "voidfang-collapse",
          name: "균열 붕괴",
          command: "균열붕괴",
          summary: "적의 다음 공격을 지연",
        },
      ],
    },
    {
      id: "offhand-aegis",
      slot: "offhand",
      name: "Aegis Buckler",
      rarity: "uncommon",
      iconPath:
        "/assets/images/weapon_icons_pixel/96/club_uncommon_oak_battle.png",
      passive: "방어 성공 시 AP 1 회복",
      skills: [
        {
          id: "aegis-guard",
          name: "아이기스 방패",
          command: "아이기스방패",
          summary: "받는 피해를 한 번 막음",
        },
        {
          id: "aegis-counter",
          name: "반격 자세",
          command: "반격자세",
          summary: "다음 방어 후 반격",
        },
      ],
    },
    {
      id: "offhand-echo",
      slot: "offhand",
      name: "Echo Crossbow",
      rarity: "rare",
      iconPath:
        "/assets/images/weapon_icons_pixel/96/crossbow_rare_echo.png",
      passive: "스킬 적중 시 다음 명령 길이 -1",
      skills: [
        {
          id: "echo-bolt",
          name: "메아리 화살",
          command: "메아리화살",
          summary: "같은 적에게 두 번 타격",
        },
        {
          id: "echo-reload",
          name: "잔향 장전",
          command: "잔향장전",
          summary: "다음 스킬의 AP 비용 감소",
        },
      ],
    },
    {
      id: "ring-echoes",
      slot: "ring-1",
      name: "Ring of Echoes",
      rarity: "rare",
      iconPath:
        "/assets/images/weapon_icons_pixel/96/wand_rare_lightning_weave.png",
      passive: "같은 명령을 연속 사용하면 피해 +8%",
      skills: [
        {
          id: "echo-memory",
          name: "잔향 기억",
          command: "잔향기억",
          summary: "직전 명령을 한 번 보존",
        },
      ],
    },
    {
      id: "ring-ember",
      slot: "ring-1",
      name: "Cinder Loop",
      rarity: "epic",
      iconPath:
        "/assets/images/weapon_icons_pixel/96/wand_uncommon_ember.png",
      passive: "화상 부여 시 AP 회복량 +1",
      skills: [
        {
          id: "cinder-mark",
          name: "잿불 각인",
          command: "잿불각인",
          summary: "적에게 화상 표식을 남김",
        },
      ],
    },
    {
      id: "ring-sigil",
      slot: "ring-2",
      name: "Star Sigil",
      rarity: "uncommon",
      iconPath:
        "/assets/images/weapon_icons_pixel/96/staff_rare_three_primary.png",
      passive: "스킬 시전 중 받는 피해 -6%",
      skills: [
        {
          id: "star-sigil",
          name: "별의 문장",
          command: "별의문장",
          summary: "다음 스킬의 시전 시간을 단축",
        },
      ],
    },
    {
      id: "ring-orbit",
      slot: "ring-2",
      name: "Orbit Seal",
      rarity: "legendary",
      iconPath:
        "/assets/images/weapon_icons_pixel/96/staff_uncommon_blue_focus.png",
      passive: "콤보가 끊겨도 1단계 유지",
      skills: [
        {
          id: "orbit-seal",
          name: "궤도 봉인",
          command: "궤도봉인",
          summary: "다음 콤보 입력을 보정",
        },
      ],
    },
  ],
};

export function createEquipmentAdapter(
  initialSnapshot: EquipmentSnapshot = EQUIPMENT_FIXTURE,
): EquipmentAdapter {
  let snapshot = createSnapshot(initialSnapshot);

  return {
    getSnapshot(): EquipmentSnapshot {
      return createSnapshot(snapshot);
    },

    equip(slot: EquipmentSlot, equipmentId: string): EquipmentSnapshot {
      const equipment = snapshot.ownedEquipment.find(
        (candidate) => candidate.id === equipmentId,
      );

      if (!equipment) {
        throw new Error(`Unknown equipment: ${equipmentId}`);
      }
      if (equipment.slot !== slot) {
        throw new Error(
          `Equipment ${equipmentId} cannot be equipped in ${slot}.`,
        );
      }

      snapshot = createSnapshot({
        ...snapshot,
        equippedBySlot: {
          ...snapshot.equippedBySlot,
          [slot]: equipmentId,
        },
      });
      return createSnapshot(snapshot);
    },
  };
}

export function findEquipment(
  snapshot: EquipmentSnapshot,
  equipmentId: string,
): EquipmentDefinition | undefined {
  return snapshot.ownedEquipment.find(
    (equipment) => equipment.id === equipmentId,
  );
}
