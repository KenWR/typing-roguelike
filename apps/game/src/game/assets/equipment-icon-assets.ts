import { EQUIPMENT_CONFIGS } from "@typing-roguelike/shared";

const EQUIPMENT_ICON_DIRECTORY = "/assets/images/weapon_icons_pixel/96";
const SUBWEAPON_ICON_DIRECTORY = "/assets/subweapons";

/**
 * 장비 ID 에서 `weapon_icons_pixel` 파일 이름으로의 대응표.
 *
 * 아이콘 세트는 무기 슬롯 8종만 다루므로 보조무기(방패·마법서·구슬·화살통)는
 * 여기에 없다. 장비 이름이 바뀌어도 조용히 깨지지 않도록 자동 매칭 대신
 * 명시적인 표로 관리한다.
 */
const WEAPON_ICON_FILE_BY_ID: Readonly<Record<string, string>> = {
  equipment_rusty_sword: "sword_common_rusty",
  equipment_blood_sword: "sword_uncommon_bloodletting",
  equipment_wind_sword: "sword_uncommon_wind",
  equipment_duelist_silver_sword: "sword_rare_duelist_silver",
  equipment_pulsing_blood_sword: "sword_rare_pulsing_blood",
  equipment_eclipse_sword: "sword_epic_moon_eclipse",
  equipment_infinite_combo_sword: "sword_epic_infinite_combo",
  equipment_oath_eating_knife: "sword_legendary_oath_eater",
  equipment_military_greatsword: "greatsword_uncommon_military_crusher",
  equipment_ash_greatsword: "greatsword_uncommon_ash",
  equipment_earthquake_greatsword: "greatsword_rare_earthquake",
  equipment_executioner_blacksteel: "greatsword_rare_executioner_black_iron",
  equipment_mountain_cutter: "greatsword_epic_mountain_cleaver",
  equipment_time_knot_greatsword: "greatsword_epic_time_knot",
  equipment_stopped_noon: "greatsword_legendary_stopped_noon",
  equipment_ember_wand: "wand_uncommon_ember",
  equipment_frostvein_wand: "wand_uncommon_frost_vein",
  equipment_lightning_wand: "wand_rare_lightning_weave",
  equipment_void_vibration_wand: "wand_rare_void_vibration",
  equipment_seven_flame_wand: "wand_epic_seven_flames",
  equipment_stormheart_wand: "wand_epic_storm_heart",
  equipment_apprentice_element_staff: "staff_uncommon_apprentice_elemental",
  equipment_blue_focus_staff: "staff_uncommon_blue_focus",
  equipment_primary_color_staff: "staff_rare_three_primary",
  equipment_mana_branch_staff: "staff_rare_mana_branch",
  equipment_worldtree_staff: "staff_epic_world_tree_pulse",
  equipment_eclipse_record_staff: "staff_epic_eclipse_record",
  equipment_three_crying_staff: "staff_legendary_thrice_weeping_sentence",
  equipment_poison_fang_bow: "bow_uncommon_venom_fang",
  equipment_hunters_longbow: "bow_uncommon_tracker",
  equipment_twin_moon_bow: "bow_rare_twin_moon",
  equipment_wind_trace_bow: "bow_rare_wind_trajectory",
  equipment_starfall_longbow: "bow_epic_star_rain",
  equipment_hunting_end: "bow_epic_hunts_end",
  equipment_space_swallowing_bow: "bow_legendary_space_eater",
  equipment_gear_crossbow: "crossbow_uncommon_cog",
  equipment_gunpowder_crossbow: "crossbow_uncommon_gunpowder",
  equipment_echo_crossbow: "crossbow_rare_echo",
  equipment_auto_crossbow: "crossbow_rare_autoload",
  equipment_time_lag_crossbow: "crossbow_epic_time_delay",
  equipment_wall_breaker: "crossbow_epic_fortress_breaker",
  equipment_reverser: "crossbow_legendary_reverser",
  equipment_crack_mace: "mace_uncommon_fracture",
  equipment_pilgrim_mace: "mace_uncommon_pilgrim",
  equipment_rupture_mace: "mace_rare_rupture",
  equipment_bell_tower_mace: "mace_rare_bell_tower",
  equipment_crown_breaker: "mace_epic_crown_crusher",
  equipment_thunder_judgment: "mace_epic_thunder_judgment",
  equipment_oak_battle_club: "club_uncommon_oak_battle",
  equipment_nail_club: "club_uncommon_nail_studded",
  equipment_goblin_club: "club_rare_goblin",
  equipment_combo_manual_club: "club_rare_combo_manual",
  equipment_bone_giant_club: "club_epic_giant_bone",
  equipment_laughing_destroyer: "club_epic_laughing_destruction",
};

const SUBWEAPON_ICON_FILE_BY_ID: Readonly<Record<string, string>> = {
  equipment_guard_round_shield: "equipment_guard_round_shield",
  equipment_thorn_shield: "equipment_thorn_shield",
  equipment_mirror_steel_shield: "equipment_mirror_steel_shield",
  equipment_fortress_shield: "equipment_fortress_shield",
  equipment_mobile_wall: "equipment_mobile_wall",
  equipment_reversal_crest_shield: "equipment_reversal_crest_shield",
  equipment_bronze_repair_tome: "equipment_bronze_repair_tome",
  equipment_flame_guard_tome: "equipment_flame_guard_tome",
  equipment_frost_veil_tome: "equipment_frost_veil_tome",
  equipment_reflection_grammar: "equipment_reflection_grammar",
  equipment_infinite_pages: "equipment_infinite_pages",
  equipment_final_chapter: "equipment_final_chapter",
  equipment_forewarning_orb: "equipment_forewarning_orb",
  equipment_clear_crystal_orb: "equipment_clear_crystal_orb",
  equipment_binocular_orb: "equipment_binocular_orb",
  equipment_perfect_crystal_orb: "equipment_perfect_crystal_orb",
  equipment_time_observer: "equipment_time_observer",
  equipment_fate_branch_orb: "equipment_fate_branch_orb",
  equipment_bloodfeather_quiver: "equipment_bloodfeather_quiver",
  equipment_armorpiercing_quiver: "equipment_armorpiercing_quiver",
  equipment_twin_arrow_quiver: "equipment_twin_arrow_quiver",
  equipment_hunters_quiver: "equipment_hunters_quiver",
  equipment_infinite_track_quiver: "equipment_infinite_track_quiver",
  equipment_comet_quiver: "equipment_comet_quiver",
};

const EQUIPMENT_ICON_FILE_BY_ID: Readonly<Record<string, string>> = {
  ...WEAPON_ICON_FILE_BY_ID,
  ...SUBWEAPON_ICON_FILE_BY_ID,
};

export const getEquipmentIconTextureKey = (equipmentId: string): string =>
  `equipment-icon:${equipmentId}`;

/** 아이콘이 없는 장비는 undefined 를 돌려주고, 호출부는 기존 표현으로 대체한다. */
export const resolveEquipmentIconTextureKey = (
  equipmentId: string,
): string | undefined =>
  EQUIPMENT_ICON_FILE_BY_ID[equipmentId] === undefined
    ? undefined
    : getEquipmentIconTextureKey(equipmentId);

export const EQUIPMENT_ICON_ASSETS: readonly {
  key: string;
  path: string;
}[] = [
  ...Object.entries(WEAPON_ICON_FILE_BY_ID).map(([equipmentId, file]) => ({
    key: getEquipmentIconTextureKey(equipmentId),
    path: `${EQUIPMENT_ICON_DIRECTORY}/${file}.png`,
  })),
  ...Object.entries(SUBWEAPON_ICON_FILE_BY_ID).map(([equipmentId, file]) => ({
    key: getEquipmentIconTextureKey(equipmentId),
    path: `${SUBWEAPON_ICON_DIRECTORY}/${file}.png`,
  })),
];

export const SUBWEAPON_ICON_ASSETS = EQUIPMENT_ICON_ASSETS.filter((asset) =>
  asset.path.startsWith(`${SUBWEAPON_ICON_DIRECTORY}/`),
);

/** 아이콘이 준비되지 않은 장비. 표시 대체 규칙을 테스트로 고정하기 위해 노출한다. */
export const EQUIPMENT_IDS_WITHOUT_ICON: readonly string[] = EQUIPMENT_CONFIGS
  .filter((equipment) => EQUIPMENT_ICON_FILE_BY_ID[equipment.id] === undefined)
  .map((equipment) => equipment.id);
