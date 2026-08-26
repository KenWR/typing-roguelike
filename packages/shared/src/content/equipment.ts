import type { EquipmentConfig, EquipmentKind, Rarity, SkillConfig } from "./types.ts";

type EquipmentDefinition = {
  id: string;
  name: string;
  kind: EquipmentKind;
  rarity: Rarity;
  basicName: string;
  signatureNames: readonly string[];
};

type SkillValues = Pick<SkillConfig, "apCost" | "windupMs" | "recoveryMs" | "damageCoefficient">;

type EquipmentSkillOverride = SkillValues & {
  name: string;
  command: string;
  category: SkillConfig["category"];
  damage: string | null;
  effect: string;
};

type ShieldEffectDefinition = Readonly<{
  type: "shield";
  amount: number;
  durationMs: number;
}>;

const EQUIPMENT_SKILL_OVERRIDES: Readonly<Record<string, readonly EquipmentSkillOverride[]>> = {
  equipment_blood_sword: [
    { name: "베기", command: "베기", category: "basic", damageCoefficient: 0.9, damage: "90%", effect: "90% + 출혈 2", apCost: 1, windupMs: 150, recoveryMs: 150 },
    { name: "꿰뚫기", command: "꿰뚫기", category: "special", damageCoefficient: 1.7, damage: "170%", effect: "170%. 출혈 대상이면 +30%", apCost: 3, windupMs: 350, recoveryMs: 200 },
  ],
  equipment_wind_sword: [
    { name: "베기", command: "베기", category: "basic", damageCoefficient: 0.85, damage: "85%", effect: "85%, 선딜 0.05초", apCost: 1, windupMs: 50, recoveryMs: 150 },
    { name: "바람 찌르기", command: "바람 찌르기", category: "special", damageCoefficient: 1.5, damage: "150%", effect: "150%", apCost: 2, windupMs: 350, recoveryMs: 200 },
  ],
  equipment_duelist_silver_sword: [
    { name: "베기", command: "베기", category: "basic", damageCoefficient: 1, damage: "100%", effect: "100%. 적 1명일 때 125%", apCost: 1, windupMs: 150, recoveryMs: 150 },
    { name: "응수 찌르기", command: "응수 찌르기", category: "special", damageCoefficient: 2.4, damage: null, effect: "완벽 방어 후 3초 내 240%", apCost: 3, windupMs: 350, recoveryMs: 200 },
  ],
  equipment_pulsing_blood_sword: [
    { name: "베기", command: "베기", category: "basic", damageCoefficient: 0.8, damage: "80%", effect: "80% + 출혈 1, 적중 시 HP 1% 회복", apCost: 1, windupMs: 150, recoveryMs: 150 },
    { name: "혈수 찌르기", command: "혈수 찌르기", category: "special", damageCoefficient: 1.6, damage: "160%", effect: "160% + 출혈 중첩당 35%, 중첩 소비", apCost: 3, windupMs: 350, recoveryMs: 200 },
  ],
  equipment_eclipse_sword: [
    { name: "베기", command: "베기", category: "basic", damageCoefficient: 1.1, damage: "110%", effect: "110% + 월식 표식 1, 최대 3", apCost: 1, windupMs: 150, recoveryMs: 150 },
    { name: "월식 관통", command: "월식 관통", category: "special", damageCoefficient: 2.2, damage: "220%", effect: "220%. 표식 3이면 광역 100% 추가", apCost: 4, windupMs: 350, recoveryMs: 200 },
  ],
  equipment_infinite_combo_sword: [
    { name: "베기", command: "베기", category: "basic", damageCoefficient: 0.75, damage: "75%", effect: "75%. 연속 정확 입력마다 +15%, 최대 150%", apCost: 1, windupMs: 150, recoveryMs: 150 },
    { name: "끊지 않는 찌르기", command: "끊지 않는 찌르기", category: "special", damageCoefficient: 0.45, damage: null, effect: "현재 연속 성공 수당 45%, 최대 360%, 연속 수 초기화", apCost: 4, windupMs: 350, recoveryMs: 200 },
  ],
  equipment_oath_eating_knife: [
    { name: "새기기", command: "새기기", category: "basic", damageCoefficient: 0.85, damage: "85%", effect: "85% + 서약 1. 오타 없는 입력은 2, 최대 4.", apCost: 1, windupMs: 150, recoveryMs: 150 },
    { name: "징수", command: "징수", category: "special", damageCoefficient: 1, damage: "100%", effect: "100% + 서약당 55%. 4중첩이면 남은 출혈 피해 즉시 적용.", apCost: 3, windupMs: 400, recoveryMs: 200 },
  ],
  equipment_military_greatsword: [
    { name: "휘두르기", command: "휘두르기", category: "basic", damageCoefficient: 1.7, damage: "170%", effect: "170% + 약화 1", apCost: 2, windupMs: 550, recoveryMs: 250 },
    { name: "내려찍기", command: "내려찍기", category: "special", damageCoefficient: 2.6, damage: "260%", effect: "260% + 균열 1", apCost: 4, windupMs: 900, recoveryMs: 150 },
    { name: "지면 가르기", command: "지면 가르기", category: "special", damageCoefficient: 1.45, damage: "145%", effect: "광역 145%", apCost: 4, windupMs: 750, recoveryMs: 350 },
  ],
  equipment_ash_greatsword: [
    { name: "휘두르기", command: "휘두르기", category: "basic", damageCoefficient: 1.5, damage: "150%", effect: "150% + 출혈 1", apCost: 2, windupMs: 550, recoveryMs: 250 },
    { name: "재 베기", command: "재 베기", category: "special", damageCoefficient: 2.3, damage: "230%", effect: "230% + 출혈 2", apCost: 4, windupMs: 900, recoveryMs: 150 },
    { name: "연무 가르기", command: "연무 가르기", category: "special", damageCoefficient: 1.3, damage: "130%", effect: "광역 130% + 명중률 저하 3초", apCost: 4, windupMs: 750, recoveryMs: 350 },
  ],
  equipment_earthquake_greatsword: [
    { name: "휘두르기", command: "휘두르기", category: "basic", damageCoefficient: 1.65, damage: "165%", effect: "165% 충격 + 균열 1", apCost: 2, windupMs: 550, recoveryMs: 250 },
    { name: "진원 내려찍기", command: "진원 내려찍기", category: "special", damageCoefficient: 2.9, damage: "290%", effect: "290%, 기절", apCost: 4, windupMs: 900, recoveryMs: 150 },
    { name: "여진", command: "여진", category: "special", damageCoefficient: 0.9, damage: "90%", effect: "광역 90%를 2회", apCost: 4, windupMs: 750, recoveryMs: 350 },
  ],
  equipment_executioner_blacksteel: [
    { name: "휘두르기", command: "휘두르기", category: "basic", damageCoefficient: 1.8, damage: "180%", effect: "180%, HP 30% 이하 적에게 225%", apCost: 2, windupMs: 550, recoveryMs: 250 },
    { name: "처형", command: "처형", category: "special", damageCoefficient: 3.2, damage: "320%", effect: "320%, HP 20% 이하 일반 적 즉시 처치", apCost: 4, windupMs: 900, recoveryMs: 150 },
    { name: "공포의 횡베기", command: "공포의 횡베기", category: "special", damageCoefficient: 1.6, damage: "160%", effect: "광역 160% + 약화 2", apCost: 4, windupMs: 750, recoveryMs: 350 },
  ],
  equipment_mountain_cutter: [
    { name: "휘두르기", command: "휘두르기", category: "basic", damageCoefficient: 2, damage: "200%", effect: "200%, 방어 20% 무시", apCost: 2, windupMs: 550, recoveryMs: 250 },
    { name: "산 가르기", command: "산 가르기", category: "special", damageCoefficient: 3.5, damage: "350%", effect: "350%, 방어 60% 무시", apCost: 5, windupMs: 900, recoveryMs: 150 },
    { name: "낙석", command: "낙석", category: "special", damageCoefficient: 1.8, damage: "180%", effect: "광역 180% + 균열 2", apCost: 4, windupMs: 750, recoveryMs: 350 },
  ],
  equipment_time_knot_greatsword: [
    { name: "휘두르기", command: "휘두르기", category: "basic", damageCoefficient: 1.5, damage: "150%", effect: "150%, 0.8초 뒤 동일 피해 50% 재발동", apCost: 2, windupMs: 550, recoveryMs: 250 },
    { name: "매듭 절단", command: "매듭 절단", category: "special", damage: null, effect: "대기 피해 즉시 발동", apCost: 3, windupMs: 900, recoveryMs: 150 },
    { name: "시간 낙하", command: "시간 낙하", category: "special", damageCoefficient: 2.8, damage: "280%", effect: "280% 후 적 게이지 0.8초 정지", apCost: 5, windupMs: 750, recoveryMs: 350 },
  ],
  equipment_stopped_noon: [
    { name: "한 박자 늦게", command: "한 박자 늦게", category: "basic", damageCoefficient: 1.8, damage: "180%", effect: "180%, 1초 뒤 타격. 적 시전 완료 ±0.1초면 240%와 시전 취소.", apCost: 2, windupMs: 300, recoveryMs: 1000 },
    { name: "정오를 깨뜨려라", command: "정오를 깨뜨려라", category: "special", damage: null, effect: "대기 중인 지연 공격 즉시 타격 + 각 공격 약화 1", apCost: 3, windupMs: 200, recoveryMs: 0 },
    { name: "초침을 묻어라", command: "초침을 묻어라", category: "special", damageCoefficient: 0.5, damage: "50%", effect: "적 공격 게이지 1초 정지. 다음 플레이어 기술 후딜 +50%.", apCost: 3, windupMs: 450, recoveryMs: 0 },
  ],
  equipment_ember_wand: [
    { name: "마력탄", command: "마력탄", category: "basic", damageCoefficient: 0.75, damage: "75%", effect: "75% + 화상형 출혈 1", apCost: 1, windupMs: 100, recoveryMs: 250 },
    { name: "잿불 폭발", command: "잿불 폭발", category: "special", damageCoefficient: 1.9, damage: "190%", effect: "190%. 출혈 대상 주변에 70% 광역", apCost: 3, windupMs: 450, recoveryMs: 300 },
  ],
  equipment_frostvein_wand: [
    { name: "마력탄", command: "마력탄", category: "basic", damageCoefficient: 0.65, damage: "65%", effect: "65% + 적 게이지 0.1초 지연", apCost: 1, windupMs: 100, recoveryMs: 250 },
    { name: "빙결 파동", command: "빙결 파동", category: "special", damageCoefficient: 1.7, damage: "170%", effect: "170% + 게이지 0.5초 지연", apCost: 3, windupMs: 450, recoveryMs: 300 },
  ],
  equipment_lightning_wand: [
    { name: "마력탄", command: "마력탄", category: "basic", damageCoefficient: 0.75, damage: "75%", effect: "75%", apCost: 1, windupMs: 100, recoveryMs: 250 },
    { name: "연쇄 번개", command: "연쇄 번개", category: "special", damageCoefficient: 1.45, damage: null, effect: "주 대상 145%, 다른 적 최대 2명에게 70%", apCost: 3, windupMs: 450, recoveryMs: 300 },
  ],
  equipment_void_vibration_wand: [
    { name: "마력탄", command: "마력탄", category: "basic", damageCoefficient: 0.8, damage: "80%", effect: "80%, 보호막에 120%", apCost: 1, windupMs: 100, recoveryMs: 250 },
    { name: "공허 붕괴", command: "공허 붕괴", category: "special", damageCoefficient: 2.1, damage: "210%", effect: "210%. 보호막 제거 성공 시 AP 1 회복", apCost: 3, windupMs: 450, recoveryMs: 300 },
  ],
  equipment_seven_flame_wand: [
    { name: "마력탄", command: "마력탄", category: "basic", damageCoefficient: 0.55, damage: "55%", effect: "55%. 정확 입력마다 불꽃 1, 최대 7", apCost: 1, windupMs: 100, recoveryMs: 250 },
    { name: "칠화 폭발", command: "칠화 폭발", category: "special", damageCoefficient: 1, damage: "100%", effect: "100% + 불꽃당 45%, 전부 소비", apCost: 4, windupMs: 450, recoveryMs: 300 },
  ],
  equipment_stormheart_wand: [
    { name: "마력탄", command: "마력탄", category: "basic", damageCoefficient: 0.85, damage: "85%", effect: "85%. 치명타 시 다른 적에게 60%", apCost: 1, windupMs: 100, recoveryMs: 250 },
    { name: "폭풍핵", command: "폭풍핵", category: "special", damageCoefficient: 2.4, damage: "240%", effect: "광역 240%. 적 수당 피해 +20%, 최대 +60%", apCost: 4, windupMs: 450, recoveryMs: 300 },
  ],
  equipment_apprentice_element_staff: [
    { name: "집중", command: "집중", category: "basic", damage: null, effect: "집중 1", apCost: 1, windupMs: 300, recoveryMs: 0 },
    { name: "화염 방출", command: "화염 방출", category: "special", damageCoefficient: 1.7, damage: "170%", effect: "170% + 출혈 1", apCost: 3, windupMs: 600, recoveryMs: 350 },
    { name: "서리 해방", command: "서리 해방", category: "special", damageCoefficient: 1.1, damage: "110%", effect: "광역 110% + 게이지 0.3초 지연", apCost: 4, windupMs: 850, recoveryMs: 200 },
  ],
  equipment_blue_focus_staff: [
    { name: "집중", command: "집중", category: "basic", damage: null, effect: "집중 1 + 보호막 5%", apCost: 1, windupMs: 300, recoveryMs: 0 },
    { name: "청색 방출", command: "청색 방출", category: "special", damageCoefficient: 1.5, damage: "150%", effect: "150% + 집중당 35%", apCost: 3, windupMs: 600, recoveryMs: 350 },
    { name: "푸른 장막", command: "푸른 장막", category: "special", damage: null, effect: "집중당 보호막 8%", apCost: 4, windupMs: 850, recoveryMs: 200 },
  ],
  equipment_primary_color_staff: [
    { name: "집중", command: "집중", category: "basic", damage: null, effect: "화염·서리·번개 순환", apCost: 1, windupMs: 300, recoveryMs: 0 },
    { name: "삼색 방출", command: "삼색 방출", category: "special", damageCoefficient: 0.9, damage: null, effect: "속성별 90% × 3", apCost: 4, windupMs: 600, recoveryMs: 350 },
    { name: "색상 혼합", command: "색상 혼합", category: "special", damageCoefficient: 1.8, damage: "180%", effect: "광역 180% + 약화 1", apCost: 4, windupMs: 850, recoveryMs: 200 },
  ],
  equipment_mana_branch_staff: [
    { name: "집중", command: "집중", category: "basic", damage: null, effect: "집중 1. 연속 사용 시 두 번째 AP 0", apCost: 1, windupMs: 300, recoveryMs: 0 },
    { name: "분기 방출", command: "분기 방출", category: "special", damageCoefficient: 1.5, damage: null, effect: "대상 2명에게 각각 150% + 집중 보정", apCost: 3, windupMs: 600, recoveryMs: 350 },
    { name: "합류 해방", command: "합류 해방", category: "special", damageCoefficient: 2.6, damage: null, effect: "단일 260%", apCost: 4, windupMs: 850, recoveryMs: 200 },
  ],
  equipment_worldtree_staff: [
    { name: "집중", command: "집중", category: "basic", damage: null, effect: "집중 1 + HP 2% 회복", apCost: 1, windupMs: 300, recoveryMs: 0 },
    { name: "생명 방출", command: "생명 방출", category: "special", damageCoefficient: 2, damage: "200%", effect: "200% + 소비 집중당 HP 3% 회복", apCost: 4, windupMs: 600, recoveryMs: 350 },
    { name: "뿌리 해방", command: "뿌리 해방", category: "special", damageCoefficient: 1.6, damage: "160%", effect: "광역 160% + 적 게이지 0.5초 정지", apCost: 4, windupMs: 850, recoveryMs: 200 },
  ],
  equipment_eclipse_record_staff: [
    { name: "집중", command: "집중", category: "basic", damage: null, effect: "빛·그림자 기록을 번갈아 획득", apCost: 1, windupMs: 300, recoveryMs: 0 },
    { name: "일식 방출", command: "일식 방출", category: "special", damageCoefficient: 3.2, damage: null, effect: "기록 2종 보유 시 320%", apCost: 4, windupMs: 600, recoveryMs: 350 },
    { name: "암전 해방", command: "암전 해방", category: "special", damageCoefficient: 2, damage: "200%", effect: "광역 200% + 3초간 적 명중 피해 -20%", apCost: 4, windupMs: 850, recoveryMs: 200 },
  ],
  equipment_three_crying_staff: [
    { name: "점화 점화 방출", command: "점화 점화 방출", category: "basic", damageCoefficient: 0.9, damage: "90%", effect: "점화마다 집중 1. 방출은 90% + 집중당 70%.", apCost: 2, windupMs: 150, recoveryMs: 300 },
    { name: "세 번 울려라", command: "세 번 울려라", category: "special", damageCoefficient: 0.5, damage: "50%", effect: "직전 방출을 50% 위력으로 2회 추가", apCost: 4, windupMs: 550, recoveryMs: 200 },
    { name: "침묵 뒤의 폭음", command: "침묵 뒤의 폭음", category: "special", damageCoefficient: 2.8, damage: "280%", effect: "1초 무입력 후 광역 280% + 기절", apCost: 4, windupMs: 700, recoveryMs: 250 },
  ],
  equipment_poison_fang_bow: [
    { name: "사격", command: "사격", category: "basic", damageCoefficient: 1.05, damage: "105%", effect: "105% + 출혈 1", apCost: 1, windupMs: 250, recoveryMs: 450 },
    { name: "독니 속사", command: "독니 속사", category: "special", damageCoefficient: 0.5, damage: "50% × 3", effect: "50% × 3 + 마지막 출혈 2", apCost: 3, windupMs: 350, recoveryMs: 200 },
    { name: "추적 사격", command: "추적 사격", category: "special", damageCoefficient: 1.7, damage: "170%", effect: "170%, 준비 중 적이면 220%", apCost: 3, windupMs: 600, recoveryMs: 250 },
  ],
  equipment_hunters_longbow: [
    { name: "사격", command: "사격", category: "basic", damageCoefficient: 1.15, damage: "115%", effect: "115%, 초점 대상 유지 시 +15%", apCost: 1, windupMs: 250, recoveryMs: 450 },
    { name: "표식 속사", command: "표식 속사", category: "special", damageCoefficient: 0.6, damage: "60% × 3", effect: "60% × 3 + 표식 1", apCost: 3, windupMs: 350, recoveryMs: 200 },
    { name: "사냥 마무리", command: "사냥 마무리", category: "special", damageCoefficient: 2.3, damage: null, effect: "표식 대상 230%", apCost: 4, windupMs: 600, recoveryMs: 250 },
  ],
  equipment_twin_moon_bow: [
    { name: "사격", command: "사격", category: "basic", damageCoefficient: 0.6, damage: "60% × 2", effect: "60% × 2", apCost: 1, windupMs: 250, recoveryMs: 450 },
    { name: "반월 속사", command: "반월 속사", category: "special", damageCoefficient: 0.45, damage: "45% × 6", effect: "45% × 6", apCost: 4, windupMs: 350, recoveryMs: 200 },
    { name: "만월 관통", command: "만월 관통", category: "special", damageCoefficient: 2.2, damage: "220%", effect: "220%, 두 화살 모두 치명타 가능", apCost: 4, windupMs: 600, recoveryMs: 250 },
  ],
  equipment_wind_trace_bow: [
    { name: "사격", command: "사격", category: "basic", damageCoefficient: 1.1, damage: "110%", effect: "110%, 후딜 0.20초", apCost: 1, windupMs: 250, recoveryMs: 200 },
    { name: "돌풍 속사", command: "돌풍 속사", category: "special", damageCoefficient: 0.65, damage: "65% × 3", effect: "65% × 3, 대상 전환 가능", apCost: 3, windupMs: 350, recoveryMs: 200 },
    { name: "궤적 관통", command: "궤적 관통", category: "special", damageCoefficient: 1.9, damage: null, effect: "일렬 적 모두 190%", apCost: 4, windupMs: 600, recoveryMs: 250 },
  ],
  equipment_starfall_longbow: [
    { name: "사격", command: "사격", category: "basic", damageCoefficient: 1, damage: "100%", effect: "100% + 별조각 1, 최대 5", apCost: 1, windupMs: 250, recoveryMs: 450 },
    { name: "별비", command: "별비", category: "special", damageCoefficient: 0.7, damage: null, effect: "별조각당 무작위 적에게 70%", apCost: 4, windupMs: 350, recoveryMs: 200 },
    { name: "낙성 관통", command: "낙성 관통", category: "special", damageCoefficient: 2.6, damage: "260%", effect: "260% + 소비 조각당 25%", apCost: 4, windupMs: 600, recoveryMs: 250 },
  ],
  equipment_hunting_end: [
    { name: "사격", command: "사격", category: "basic", damageCoefficient: 1.3, damage: "130%", effect: "130%, HP 50% 이하 적에게 160%", apCost: 1, windupMs: 250, recoveryMs: 450 },
    { name: "종언 속사", command: "종언 속사", category: "special", damageCoefficient: 0.75, damage: "75% × 4", effect: "75% × 4, 처치 시 AP 2 회복", apCost: 4, windupMs: 350, recoveryMs: 200 },
    { name: "마지막 관통", command: "마지막 관통", category: "special", damageCoefficient: 3, damage: "300%", effect: "300%, HP 20% 이하일 때 확정 치명타", apCost: 5, windupMs: 600, recoveryMs: 250 },
  ],
  equipment_space_swallowing_bow: [
    { name: "숨 고르고 사격", command: "숨 고르고 사격", category: "basic", damageCoefficient: 1.2, damage: "120%", effect: "120%. 두 호흡 구간 성공 시 확정 치명타.", apCost: 1, windupMs: 250, recoveryMs: 400 },
    { name: "소리 없이 꿰뚫기", command: "소리 없이 꿰뚫기", category: "special", damageCoefficient: 2.3, damage: "230%", effect: "1초 무입력 후 230%, 방어 100% 무시 + 출혈 2", apCost: 4, windupMs: 600, recoveryMs: 250 },
    { name: "마지막 숨", command: "마지막 숨", category: "special", damageCoefficient: 0.3, damage: "30%", effect: "HP 30% 이하에서 180% + 소비 콤보당 8%, 최대 +160%", apCost: 4, windupMs: 700, recoveryMs: 200 },
  ],
  equipment_gear_crossbow: [
    { name: "발사", command: "발사", category: "basic", damageCoefficient: 2.3, damage: "230%", effect: "230% + 출혈 1, 장전 소비", apCost: 1, windupMs: 100, recoveryMs: 550 },
    { name: "재장전", command: "재장전", category: "basic", damage: null, effect: "장전 1", apCost: 1, windupMs: 700, recoveryMs: 0 },
    { name: "톱니 연발", command: "톱니 연발", category: "special", damageCoefficient: 1, damage: "100% × 3", effect: "100% × 3 + 출혈 1", apCost: 4, windupMs: 450, recoveryMs: 350 },
    { name: "절삭 볼트", command: "절삭 볼트", category: "special", damageCoefficient: 2.5, damage: "250%", effect: "250% + 출혈 2", apCost: 4, windupMs: 450, recoveryMs: 350 },
  ],
  equipment_gunpowder_crossbow: [
    { name: "발사", command: "발사", category: "basic", damageCoefficient: 2.4, damage: "240%", effect: "240%, 주위 50% 광역", apCost: 1, windupMs: 100, recoveryMs: 550 },
    { name: "재장전", command: "재장전", category: "basic", damage: null, effect: "장전 1", apCost: 1, windupMs: 700, recoveryMs: 0 },
    { name: "폭발 연발", command: "폭발 연발", category: "special", damageCoefficient: 0.9, damage: "90% × 3", effect: "90% × 3 광역", apCost: 4, windupMs: 450, recoveryMs: 350 },
    { name: "화약 볼트", command: "화약 볼트", category: "special", damageCoefficient: 2.3, damage: "230%", effect: "광역 230%", apCost: 4, windupMs: 450, recoveryMs: 350 },
  ],
  equipment_echo_crossbow: [
    { name: "발사", command: "발사", category: "basic", damageCoefficient: 2.25, damage: "225%", effect: "225%", apCost: 1, windupMs: 100, recoveryMs: 550 },
    { name: "재장전", command: "재장전", category: "basic", damage: null, effect: "장전 1", apCost: 1, windupMs: 700, recoveryMs: 0 },
    { name: "잔향탄", command: "잔향탄", category: "special", damageCoefficient: 1.5, damage: "150%", effect: "150% 후 0.8초 뒤 150%", apCost: 4, windupMs: 450, recoveryMs: 350 },
    { name: "빈 탄창 반격", command: "빈 탄창 반격", category: "special", damageCoefficient: 0.9, damage: null, effect: "비장전 시 90% + 자동 장전", apCost: 2, windupMs: 450, recoveryMs: 350 },
  ],
  equipment_auto_crossbow: [
    { name: "발사", command: "발사", category: "basic", damageCoefficient: 2, damage: "200%", effect: "200%. 30% 확률 자동 장전", apCost: 1, windupMs: 100, recoveryMs: 550 },
    { name: "재장전", command: "재장전", category: "basic", damage: null, effect: "장전 1 + 다음 발사 20%", apCost: 1, windupMs: 700, recoveryMs: 0 },
    { name: "연속 볼트", command: "연속 볼트", category: "special", damageCoefficient: 0.95, damage: "95% × 4", effect: "95% × 4", apCost: 4, windupMs: 450, recoveryMs: 350 },
    { name: "회전 탄창", command: "회전 탄창", category: "special", damage: null, effect: "장전 2 획득", apCost: 3, windupMs: 450, recoveryMs: 350 },
  ],
  equipment_time_lag_crossbow: [
    { name: "발사", command: "발사", category: "basic", damageCoefficient: 2.1, damage: "210%", effect: "210% 후 1초 뒤 100%", apCost: 1, windupMs: 100, recoveryMs: 550 },
    { name: "재장전", command: "재장전", category: "basic", damage: null, effect: "장전 1", apCost: 1, windupMs: 700, recoveryMs: 0 },
    { name: "시차 연발", command: "시차 연발", category: "special", damageCoefficient: 1.2, damage: "120% × 3", effect: "120% × 3이 0.5초 간격 적중", apCost: 4, windupMs: 450, recoveryMs: 350 },
    { name: "정지 볼트", command: "정지 볼트", category: "special", damageCoefficient: 2.6, damage: "260%", effect: "260% + 게이지 0.8초 정지", apCost: 5, windupMs: 450, recoveryMs: 350 },
  ],
  equipment_wall_breaker: [
    { name: "발사", command: "발사", category: "basic", damageCoefficient: 2.6, damage: "260%", effect: "260%, 보호막에 340%", apCost: 1, windupMs: 100, recoveryMs: 550 },
    { name: "재장전", command: "재장전", category: "basic", damage: null, effect: "장전 1", apCost: 1, windupMs: 700, recoveryMs: 0 },
    { name: "공성 연발", command: "공성 연발", category: "special", damageCoefficient: 1.3, damage: "130% × 3", effect: "130% × 3, 방어 30% 무시", apCost: 4, windupMs: 450, recoveryMs: 350 },
    { name: "성벽 붕괴", command: "성벽 붕괴", category: "special", damageCoefficient: 3.6, damage: "360%", effect: "360%, 보호막 제거 시 균열 3", apCost: 5, windupMs: 450, recoveryMs: 350 },
  ],
  equipment_reverser: [
    { name: "격사", command: "격사", category: "basic", damageCoefficient: 2.4, damage: "240%", effect: "240%, 방어 40% 무시, 장전 1 소비", apCost: 1, windupMs: 100, recoveryMs: 500 },
    { name: "전장재", command: "전장재", category: "basic", damage: null, effect: "장전 1. 1초 안에 입력하면 다음 격사 후딜 -0.20초.", apCost: 1, windupMs: 600, recoveryMs: 0 },
    { name: "되돌린 탄환", command: "되돌린 탄환", category: "special", damageCoefficient: 1.8, damage: "180%", effect: "180% 후 0.8초 뒤 120% 귀환 피해 + 자동 장전", apCost: 4, windupMs: 450, recoveryMs: 350 },
    { name: "끝에서 처음으로", command: "끝에서 처음으로", category: "special", damage: null, effect: "적 공격 역순 입력 성공 시 공격 취소 + 격사. 전투당 1회.", apCost: 3, windupMs: 0, recoveryMs: 0 },
  ],
  equipment_crack_mace: [
    { name: "강타", command: "강타", category: "basic", damageCoefficient: 1.25, damage: "125%", effect: "125% + 균열 1", apCost: 2, windupMs: 350, recoveryMs: 150 },
    { name: "갑옷 분쇄", command: "갑옷 분쇄", category: "special", damageCoefficient: 1.9, damage: "190%", effect: "190% + 방어 -35%", apCost: 3, windupMs: 500, recoveryMs: 150 },
  ],
  equipment_pilgrim_mace: [
    { name: "강타", command: "강타", category: "basic", damageCoefficient: 1.15, damage: "115%", effect: "115%. 정확 입력 시 보호막 3%", apCost: 2, windupMs: 350, recoveryMs: 150 },
    { name: "참회 타격", command: "참회 타격", category: "special", damageCoefficient: 1.8, damage: "180%", effect: "180% + 약화 1", apCost: 3, windupMs: 500, recoveryMs: 150 },
  ],
  equipment_rupture_mace: [
    { name: "강타", command: "강타", category: "basic", damageCoefficient: 1.25, damage: "125%", effect: "125% + 균열 1", apCost: 2, windupMs: 350, recoveryMs: 150 },
    { name: "파쇄", command: "파쇄", category: "special", damageCoefficient: 2, damage: "200%", effect: "200% + 소비 균열당 35%", apCost: 3, windupMs: 500, recoveryMs: 150 },
  ],
  equipment_bell_tower_mace: [
    { name: "강타", command: "강타", category: "basic", damageCoefficient: 1.3, damage: "130%", effect: "130%. 세 번째 적중 기절", apCost: 2, windupMs: 350, recoveryMs: 150 },
    { name: "대종 강타", command: "대종 강타", category: "special", damageCoefficient: 2.1, damage: "210%", effect: "210% + 기절", apCost: 4, windupMs: 500, recoveryMs: 150 },
  ],
  equipment_crown_breaker: [
    { name: "강타", command: "강타", category: "basic", damageCoefficient: 1.5, damage: "150%", effect: "150%, 엘리트·보스에게 180%", apCost: 2, windupMs: 350, recoveryMs: 150 },
    { name: "왕권 파쇄", command: "왕권 파쇄", category: "special", damageCoefficient: 2.6, damage: "260%", effect: "260% + 방어 -50%", apCost: 4, windupMs: 500, recoveryMs: 150 },
  ],
  equipment_thunder_judgment: [
    { name: "강타", command: "강타", category: "basic", damageCoefficient: 1.35, damage: "135%", effect: "135% + 다른 적에게 60%", apCost: 2, windupMs: 350, recoveryMs: 150 },
    { name: "낙뢰 분쇄", command: "낙뢰 분쇄", category: "special", damageCoefficient: 2.5, damage: null, effect: "주 대상 250% + 나머지 140%", apCost: 4, windupMs: 500, recoveryMs: 150 },
  ],
  equipment_oak_battle_club: [
    { name: "후려치기", command: "후려치기", category: "basic", damageCoefficient: 1.45, damage: "145%", effect: "145%, 피해 편차 제거", apCost: 2, windupMs: 400, recoveryMs: 100 },
    { name: "연속 타격", command: "연속 타격", category: "special", damageCoefficient: 0.65, damage: "65% × 4", effect: "65% × 4", apCost: 4, windupMs: 500, recoveryMs: 100 },
    { name: "기절 강타", command: "기절 강타", category: "special", damageCoefficient: 2, damage: "200%", effect: "200% + 기절", apCost: 4, windupMs: 500, recoveryMs: 100 },
  ],
  equipment_nail_club: [
    { name: "후려치기", command: "후려치기", category: "basic", damageCoefficient: 1.3, damage: "130%", effect: "130% + 출혈 1", apCost: 2, windupMs: 400, recoveryMs: 100 },
    { name: "못 연타", command: "못 연타", category: "special", damageCoefficient: 0.6, damage: "60% × 4", effect: "60% × 4 + 출혈 1", apCost: 4, windupMs: 500, recoveryMs: 100 },
    { name: "박아넣기", command: "박아넣기", category: "special", damageCoefficient: 2.1, damage: "210%", effect: "210% + 출혈 2", apCost: 4, windupMs: 500, recoveryMs: 100 },
  ],
  equipment_goblin_club: [
    { name: "후려치기", command: "후려치기", category: "basic", damageCoefficient: 2.2, damage: "100~220%", effect: "100~220% 무작위", apCost: 2, windupMs: 400, recoveryMs: 100 },
    { name: "도깨비 난타", command: "도깨비 난타", category: "special", damageCoefficient: 1, damage: "50~100%", effect: "50~100% × 5", apCost: 4, windupMs: 500, recoveryMs: 100 },
    { name: "대박 강타", command: "대박 강타", category: "special", damageCoefficient: 0.2, damage: "20%", effect: "20% 확률 400%, 아니면 160%", apCost: 4, windupMs: 500, recoveryMs: 100 },
  ],
  equipment_combo_manual_club: [
    { name: "후려치기", command: "후려치기", category: "basic", damageCoefficient: 1.2, damage: "120%", effect: "120%. 연속 성공마다 +20%", apCost: 2, windupMs: 400, recoveryMs: 100 },
    { name: "교본 연타", command: "교본 연타", category: "special", damageCoefficient: 0.6, damage: "60%", effect: "60% × 현재 연속 성공 수, 최대 6회", apCost: 4, windupMs: 500, recoveryMs: 100 },
    { name: "마침표", command: "마침표", category: "special", damageCoefficient: 2.2, damage: "220%", effect: "220% + 연속 수 초기화", apCost: 3, windupMs: 500, recoveryMs: 100 },
  ],
  equipment_bone_giant_club: [
    { name: "후려치기", command: "후려치기", category: "basic", damageCoefficient: 2, damage: "200%", effect: "200%, 선딜 0.65초", apCost: 2, windupMs: 650, recoveryMs: 100 },
    { name: "거인 난타", command: "거인 난타", category: "special", damageCoefficient: 1, damage: "100% × 4", effect: "100% × 4", apCost: 5, windupMs: 500, recoveryMs: 100 },
    { name: "골분쇄", command: "골분쇄", category: "special", damageCoefficient: 3.3, damage: "330%", effect: "330% + 균열 2", apCost: 5, windupMs: 500, recoveryMs: 100 },
  ],
  equipment_laughing_destroyer: [
    { name: "후려치기", command: "후려치기", category: "basic", damageCoefficient: 1.4, damage: "140%", effect: "140%. 치명타마다 AP 1 회복", apCost: 2, windupMs: 400, recoveryMs: 100 },
    { name: "광소 난타", command: "광소 난타", category: "special", damageCoefficient: 0.7, damage: "70% × 5", effect: "70% × 5, 각 타격 치명타", apCost: 4, windupMs: 500, recoveryMs: 100 },
    { name: "폭소 강타", command: "폭소 강타", category: "special", damageCoefficient: 2.4, damage: "240%", effect: "240%, 치명타면 한 번 더 120%", apCost: 4, windupMs: 500, recoveryMs: 100 },
  ],
  equipment_guard_round_shield: [
    { name: "방패 들기", command: "방패 들기", category: "guard", damage: null, effect: "실드 24, 0.9초", apCost: 1, windupMs: 100, recoveryMs: 0 },
    { name: "방진 전개", command: "방진 전개", category: "guard", damage: null, effect: "실드 30, 1.2초", apCost: 2, windupMs: 200, recoveryMs: 0 },
  ],
  equipment_thorn_shield: [
    { name: "방패 들기", command: "방패 들기", category: "guard", damage: null, effect: "실드 22, 0.8초. 흡수한 피해의 20% 반사", apCost: 1, windupMs: 100, recoveryMs: 0 },
    { name: "가시 받아치기", command: "가시 받아치기", category: "guard", damage: null, effect: "실드 45, 0.35초 + 130% 반격", apCost: 2, windupMs: 150, recoveryMs: 0 },
  ],
  equipment_mirror_steel_shield: [
    { name: "방패 들기", command: "방패 들기", category: "guard", damage: null, effect: "실드 20, 0.8초", apCost: 1, windupMs: 100, recoveryMs: 0 },
    { name: "거울 반격", command: "거울 반격", category: "guard", damage: null, effect: "실드 50, 0.35초. 마법을 흡수하면 100% 반사", apCost: 3, windupMs: 150, recoveryMs: 0 },
  ],
  equipment_fortress_shield: [
    { name: "방패 들기", command: "방패 들기", category: "guard", damage: null, effect: "실드 28, 1.2초. 이동 불가", apCost: 2, windupMs: 100, recoveryMs: 0 },
    { name: "성벽 자세", command: "성벽 자세", category: "guard", damage: null, effect: "실드 40, 2초. 공격 불가", apCost: 3, windupMs: 150, recoveryMs: 0 },
  ],
  equipment_mobile_wall: [
    { name: "방패 들기", command: "방패 들기", category: "guard", damage: null, effect: "실드 26, 1초. 대상 전환 가능", apCost: 1, windupMs: 100, recoveryMs: 0 },
    { name: "전진 방벽", command: "전진 방벽", category: "guard", damage: null, effect: "실드 32, 1초. 실드 유지 중 공격 명령 1회 예약", apCost: 3, windupMs: 150, recoveryMs: 0 },
  ],
  equipment_reversal_crest_shield: [
    { name: "방패 들기", command: "방패 들기", category: "guard", damage: null, effect: "실드 22, 0.8초. 실드로 막아내면 AP 1 회복", apCost: 1, windupMs: 100, recoveryMs: 0 },
    { name: "문장 역전", command: "문장 역전", category: "guard", damage: null, effect: "실드 48, 0.35초. 공격 이름을 정확히 입력해 취소 + 180% 반격, 전투당 2회", apCost: 3, windupMs: 150, recoveryMs: 0 },
  ],
  equipment_bronze_repair_tome: [
    { name: "보호막", command: "보호막", category: "guard", damage: null, effect: "실드 22, 4초", apCost: 2, windupMs: 350, recoveryMs: 0 },
    { name: "수복문", command: "수복문", category: "guard", damage: null, effect: "실드 11, 6초", apCost: 3, windupMs: 450, recoveryMs: 0 },
  ],
  equipment_flame_guard_tome: [
    { name: "보호막", command: "보호막", category: "guard", damage: null, effect: "실드 18, 4초. 깨질 때 주위 80%", apCost: 2, windupMs: 350, recoveryMs: 0 },
    { name: "화염 반사", command: "화염 반사", category: "guard", damage: null, effect: "실드 40, 0.6초. 흡수 시 60% 반사와 출혈 1", apCost: 3, windupMs: 450, recoveryMs: 0 },
  ],
  equipment_frost_veil_tome: [
    { name: "보호막", command: "보호막", category: "guard", damage: null, effect: "실드 20, 4초. 공격자 게이지 0.2초 지연", apCost: 2, windupMs: 350, recoveryMs: 0 },
    { name: "빙결 장막", command: "빙결 장막", category: "guard", damage: null, effect: "실드 45, 0.8초 + 기절", apCost: 3, windupMs: 450, recoveryMs: 0 },
  ],
  equipment_reflection_grammar: [
    { name: "보호막", command: "보호막", category: "guard", damage: null, effect: "실드 18, 4초", apCost: 2, windupMs: 350, recoveryMs: 0 },
    { name: "완전 반사", command: "완전 반사", category: "guard", damage: null, effect: "실드 42, 0.5초. 흡수한 피해 100% 반사", apCost: 4, windupMs: 450, recoveryMs: 0 },
  ],
  equipment_infinite_pages: [
    { name: "보호막", command: "보호막", category: "guard", damage: null, effect: "실드 15, 4초. 정확 입력 시 AP 1 반환, 전투당 3회", apCost: 2, windupMs: 350, recoveryMs: 0 },
    { name: "연속 장막", command: "연속 장막", category: "guard", damage: null, effect: "실드 22, 4초. 깨지면 50% 수치로 한 번 재생", apCost: 4, windupMs: 450, recoveryMs: 0 },
  ],
  equipment_final_chapter: [
    { name: "보호막", command: "보호막", category: "guard", damage: null, effect: "실드 25, 4초. HP 30% 이하면 40", apCost: 2, windupMs: 350, recoveryMs: 0 },
    { name: "결말 거부", command: "결말 거부", category: "guard", damage: null, effect: "실드 55, 1초. 치명 피해를 막고 HP 1 유지, 전투당 1회", apCost: 5, windupMs: 450, recoveryMs: 0 },
  ],
  equipment_forewarning_orb: [
    { name: "명상", command: "명상", category: "basic", damage: null, effect: "AP 1 회복 + 다음 적 공격 공개", apCost: 0, windupMs: 800, recoveryMs: 0 },
    { name: "예고", command: "예고", category: "special", damage: null, effect: "8초간 주 대상의 공격 2개 공개", apCost: 2, windupMs: 400, recoveryMs: 0 },
  ],
  equipment_clear_crystal_orb: [
    { name: "명상", command: "명상", category: "basic", damage: null, effect: "AP 2 회복, 선딜 0.75초, 재사용 5초", apCost: 0, windupMs: 750, recoveryMs: 0 },
    { name: "맑은 시야", command: "맑은 시야", category: "special", damage: null, effect: "다음 공격 1개 추가 공개 + AP 1", apCost: 2, windupMs: 400, recoveryMs: 0 },
  ],
  equipment_binocular_orb: [
    { name: "명상", command: "명상", category: "basic", damage: null, effect: "AP 2 회복. 다수전이면 AP 1 추가", apCost: 0, windupMs: 800, recoveryMs: 0 },
    { name: "양면 미래", command: "양면 미래", category: "special", damage: null, effect: "적 2명의 다음 공격 2개씩 공개", apCost: 3, windupMs: 400, recoveryMs: 0 },
  ],
  equipment_perfect_crystal_orb: [
    { name: "명상", command: "명상", category: "basic", damage: null, effect: "AP 2, 선딜 0.7초, 재사용 4초", apCost: 0, windupMs: 700, recoveryMs: 0 },
    { name: "결정된 미래", command: "결정된 미래", category: "special", damage: null, effect: "7초간 다음 공격 2개 공개 + 최초 완벽 방어 AP 2", apCost: 3, windupMs: 400, recoveryMs: 0 },
  ],
  equipment_time_observer: [
    { name: "명상", command: "명상", category: "basic", damage: null, effect: "AP 2 + 모든 적 게이지 0.15초 정지", apCost: 0, windupMs: 800, recoveryMs: 0 },
    { name: "시간 관측", command: "시간 관측", category: "special", damage: null, effect: "5초간 적 타격 시점 수치 표시 + 게이지 0.5초 지연", apCost: 4, windupMs: 400, recoveryMs: 0 },
  ],
  equipment_fate_branch_orb: [
    { name: "명상", command: "명상", category: "basic", damage: null, effect: "AP 3. 피격 취소 시 AP 1 손실", apCost: 0, windupMs: 800, recoveryMs: 0 },
    { name: "두 갈래 미래", command: "두 갈래 미래", category: "special", damage: null, effect: "다음 적 공격을 방어하면 AP 2, 취소하면 공격력 30% 증가 4초", apCost: 4, windupMs: 400, recoveryMs: 0 },
  ],
  equipment_bloodfeather_quiver: [
    { name: "장전 정비", command: "장전 정비", category: "basic", damage: null, effect: "다음 원거리 공격 +15%와 출혈 1", apCost: 1, windupMs: 400, recoveryMs: 0 },
    { name: "피깃 화살", command: "피깃 화살", category: "special", damage: null, effect: "다음 2회 출혈 2", apCost: 2, windupMs: 500, recoveryMs: 0 },
  ],
  equipment_armorpiercing_quiver: [
    { name: "장전 정비", command: "장전 정비", category: "basic", damage: null, effect: "다음 원거리 공격 방어 25% 무시", apCost: 1, windupMs: 400, recoveryMs: 0 },
    { name: "철갑 화살", command: "철갑 화살", category: "special", damage: null, effect: "다음 2회 방어 40% 무시", apCost: 2, windupMs: 500, recoveryMs: 0 },
  ],
  equipment_twin_arrow_quiver: [
    { name: "장전 정비", command: "장전 정비", category: "basic", damage: null, effect: "다음 공격 60% 위력으로 한 번 추가", apCost: 2, windupMs: 400, recoveryMs: 0 },
    { name: "쌍발 화살", command: "쌍발 화살", category: "special", damage: null, effect: "다음 2회가 70% × 2로 분리", apCost: 3, windupMs: 500, recoveryMs: 0 },
  ],
  equipment_hunters_quiver: [
    { name: "장전 정비", command: "장전 정비", category: "basic", damage: null, effect: "공격 준비 중 적에게 다음 피해 +30%", apCost: 1, windupMs: 400, recoveryMs: 0 },
    { name: "추적 화살", command: "추적 화살", category: "special", damage: null, effect: "다음 2회가 초점 변경 후에도 원래 대상 추적", apCost: 2, windupMs: 500, recoveryMs: 0 },
  ],
  equipment_infinite_track_quiver: [
    { name: "장전 정비", command: "장전 정비", category: "basic", damage: null, effect: "다음 공격 후 50% 확률 효과 유지", apCost: 1, windupMs: 400, recoveryMs: 0 },
    { name: "순환 화살", command: "순환 화살", category: "special", damage: null, effect: "다음 3회 적중 시 AP 1씩 회복", apCost: 3, windupMs: 500, recoveryMs: 0 },
  ],
  equipment_comet_quiver: [
    { name: "장전 정비", command: "장전 정비", category: "basic", damage: null, effect: "다음 공격 후 0.8초 뒤 광역 80%", apCost: 2, windupMs: 400, recoveryMs: 0 },
    { name: "혜성 화살", command: "혜성 화살", category: "special", damage: null, effect: "다음 공격 180% 추가 광역 + 기절", apCost: 4, windupMs: 500, recoveryMs: 0 },
  ],
};

/**
 * 실드는 커맨드를 완성하는 순간 부여되어 `amount`만큼의 피해를 흡수하고,
 * `durationMs`가 지나면 남은 양과 함께 사라집니다.
 *
 * 수치 기준은 최대 HP 100입니다. 마법서의 보호막은 설명에 적힌 "최대 HP N%"를
 * 그대로 실드량으로 쓰고, 방패는 기존 피해 감소율을 같은 체감의 흡수량으로
 * 환산했습니다. 받아치기 계열은 지속 시간이 짧은 대신 실드량이 큽니다.
 */
const EQUIPMENT_SHIELD_EFFECTS: Readonly<
  Record<string, readonly ShieldEffectDefinition[]>
> = {
  equipment_guard_round_shield: [
    { type: "shield", amount: 24, durationMs: 900 },
    { type: "shield", amount: 30, durationMs: 1_200 },
  ],
  equipment_thorn_shield: [
    { type: "shield", amount: 22, durationMs: 800 },
    { type: "shield", amount: 45, durationMs: 350 },
  ],
  equipment_mirror_steel_shield: [
    { type: "shield", amount: 20, durationMs: 800 },
    { type: "shield", amount: 50, durationMs: 350 },
  ],
  equipment_fortress_shield: [
    { type: "shield", amount: 28, durationMs: 1_200 },
    { type: "shield", amount: 40, durationMs: 2_000 },
  ],
  equipment_mobile_wall: [
    { type: "shield", amount: 26, durationMs: 1_000 },
    { type: "shield", amount: 32, durationMs: 1_000 },
  ],
  equipment_reversal_crest_shield: [
    { type: "shield", amount: 22, durationMs: 800 },
    { type: "shield", amount: 48, durationMs: 350 },
  ],
  equipment_bronze_repair_tome: [
    { type: "shield", amount: 22, durationMs: 4_000 },
    { type: "shield", amount: 11, durationMs: 6_000 },
  ],
  equipment_flame_guard_tome: [
    { type: "shield", amount: 18, durationMs: 4_000 },
    { type: "shield", amount: 40, durationMs: 600 },
  ],
  equipment_frost_veil_tome: [
    { type: "shield", amount: 20, durationMs: 4_000 },
    { type: "shield", amount: 45, durationMs: 800 },
  ],
  equipment_reflection_grammar: [
    { type: "shield", amount: 18, durationMs: 4_000 },
    { type: "shield", amount: 42, durationMs: 500 },
  ],
  equipment_infinite_pages: [
    { type: "shield", amount: 15, durationMs: 4_000 },
    { type: "shield", amount: 22, durationMs: 4_000 },
  ],
  equipment_final_chapter: [
    { type: "shield", amount: 25, durationMs: 4_000 },
    { type: "shield", amount: 55, durationMs: 1_000 },
  ],
};

const BASE_ATTACK: Readonly<Partial<Record<EquipmentKind, number>>> = {
  sword: 10,
  greatsword: 14,
  wand: 8,
  staff: 9,
  bow: 10,
  crossbow: 14,
  mace: 12,
  club: 13,
};

const SELL_VALUES: Readonly<Record<Rarity, number>> = {
  common: 45,
  uncommon: 60,
  rare: 90,
  epic: 180,
  legendary: 360,
  hidden: 0,
};

const SUBWEAPON_KINDS = new Set<EquipmentKind>([
  "shield",
  "tome",
  "orb",
  "quiver",
]);

const ATTACK_VALUES: Readonly<Partial<Record<EquipmentKind, SkillValues>>> = {
  sword: { apCost: 1, windupMs: 150, recoveryMs: 150, damageCoefficient: 0.9 },
  greatsword: { apCost: 2, windupMs: 550, recoveryMs: 250, damageCoefficient: 1.6 },
  wand: { apCost: 1, windupMs: 100, recoveryMs: 250, damageCoefficient: 0.7 },
  bow: { apCost: 1, windupMs: 250, recoveryMs: 450, damageCoefficient: 1.1 },
  crossbow: { apCost: 1, windupMs: 100, recoveryMs: 550, damageCoefficient: 2.2 },
  mace: { apCost: 2, windupMs: 350, recoveryMs: 150, damageCoefficient: 1.2 },
  club: { apCost: 2, windupMs: 400, recoveryMs: 100, damageCoefficient: 1.4 },
};

const SIGNATURE_VALUES: Readonly<Partial<Record<EquipmentKind, SkillValues>>> = {
  sword: { apCost: 3, windupMs: 350, recoveryMs: 200, damageCoefficient: 1.7 },
  greatsword: { apCost: 4, windupMs: 900, recoveryMs: 150, damageCoefficient: 2.7 },
  wand: { apCost: 3, windupMs: 450, recoveryMs: 300, damageCoefficient: 2.1 },
  staff: { apCost: 3, windupMs: 600, recoveryMs: 350, damageCoefficient: 1.6 },
  bow: { apCost: 4, windupMs: 600, recoveryMs: 250, damageCoefficient: 2 },
  crossbow: { apCost: 4, windupMs: 450, recoveryMs: 350, damageCoefficient: 2.6 },
  mace: { apCost: 3, windupMs: 500, recoveryMs: 150, damageCoefficient: 1.9 },
  club: { apCost: 4, windupMs: 500, recoveryMs: 100, damageCoefficient: 2.1 },
};

const BASIC_EFFECTS: Readonly<Partial<Record<EquipmentKind, string>>> = {
  sword: "적중 시 출혈 1을 부여합니다.",
  greatsword: "적중 시 약화 1을 부여합니다.",
  wand: "같은 대상에게 연속 적중하면 세 번째 공격이 강화됩니다.",
  staff: "집중 1을 획득합니다.",
  bow: "적이 공격 준비 중이면 피해가 증가합니다.",
  crossbow: "장전 상태에서만 사용할 수 있으며 장전 1을 소비합니다.",
  mace: "충격 피해를 주고 균열 1을 부여합니다.",
  club: "피해 편차가 있으며 정확 입력을 연속 성공하면 기절 확률이 증가합니다.",
  shield: "유효 시간 동안 받는 피해를 감소시킵니다.",
  tome: "보호막을 얻어 다음 피해를 먼저 흡수합니다.",
  orb: "피해 없이 AP를 회복하고 적의 공격 정보를 확인합니다.",
  quiver: "다음 원거리 공격을 강화합니다.",
};

const SIGNATURE_EFFECTS: Readonly<Record<string, string>> = {
  "꿰뚫기": "방어를 25% 무시합니다.",
  "내려찍기": "공격 준비 중인 적을 기절시킵니다.",
  "지면 가르기": "모든 적에게 광역 피해를 줍니다.",
  "과충전": "선딜 중 피격으로 취소되면 AP 1을 반환합니다.",
  "원소 방출": "집중 중첩마다 피해가 증가합니다.",
  "마력 해방": "집중을 소비해 광역 피해를 줍니다.",
  "속사": "여러 발을 발사하며 각 화살이 별도로 판정됩니다.",
  "관통 사격": "방어를 무시하고 출혈을 부여합니다.",
  "발사": "장전 1을 소비합니다.",
  "재장전": "장전 1을 획득합니다.",
  "연발 볼트": "장전 1을 소비해 세 번 공격합니다.",
  "파열 볼트": "출혈 2를 부여합니다.",
  "갑옷 분쇄": "적의 방어력을 감소시킵니다.",
  "기절 강타": "적을 확정적으로 기절시킵니다.",
  "방진 전개": "잠시 동안 받는 모든 피해를 크게 감소시킵니다.",
  "주문 반사": "짧은 시간 동안 피해를 차단하고 반사합니다.",
  "미래 보기": "적의 다음 공격 정보를 추가로 공개합니다.",
  "특수 화살": "다음 원거리 공격에 출혈과 방어 무시를 추가합니다.",
};

const describeDamage = (damageCoefficient: number | undefined): string =>
  damageCoefficient === undefined ? "피해 없음." : `${Math.round(damageCoefficient * 100)}% 피해.`;

const createSkill = (
  equipment: EquipmentDefinition,
  name: string,
  category: SkillConfig["category"],
  values: SkillValues,
  description: string,
  index: number,
  effect: string,
  tags: readonly string[],
  effects?: readonly ShieldEffectDefinition[],
): SkillConfig => ({
  id: `${equipment.id}-skill-${index}`,
  type: category === "basic" ? "basic" : "special",
  name,
  command: name,
  kind: SUBWEAPON_KINDS.has(equipment.kind)
    ? equipment.kind === "shield" || equipment.kind === "tome" ? "defense" : "utility"
    : "attack",
  category,
  ...values,
  damage: values.damageCoefficient === undefined
    ? null
    : `${Math.round(values.damageCoefficient * 100)}%`,
  description,
  effect,
  tags,
  ...(effects === undefined ? {} : { effects }),
});

const createSkills = (equipment: EquipmentDefinition): readonly SkillConfig[] => {
  const overrides = EQUIPMENT_SKILL_OVERRIDES[equipment.id];
  if (overrides !== undefined) {
    return overrides.map((skill, index) => {
      const isBasic = index === 0 || (equipment.kind === "crossbow" && index === 1);
      const shieldEffect = EQUIPMENT_SHIELD_EFFECTS[equipment.id]?.[index];
      return {
        ...createSkill(
          equipment,
          skill.name,
          skill.category,
          {
            apCost: skill.apCost,
            windupMs: skill.windupMs,
            recoveryMs: skill.recoveryMs,
            damageCoefficient: skill.damageCoefficient,
          },
          skill.effect,
          index + 1,
          skill.effect,
          [equipment.kind, isBasic ? "basic" : "signature"],
          shieldEffect === undefined ? undefined : [shieldEffect],
        ),
        type: isBasic ? "basic" : "special",
        command: skill.command,
        damage: skill.damage,
      };
    });
  }

  const skills: SkillConfig[] = [];
  const isSubweapon = SUBWEAPON_KINDS.has(equipment.kind);

  if (equipment.kind === "crossbow") {
    skills.push(createSkill(
      equipment,
      "발사",
      "basic",
      ATTACK_VALUES.crossbow!,
      "장전 1을 소비해 높은 피해를 줍니다.",
      1,
      "220% 피해. 장전 1을 소비합니다.",
      ["ranged", "loaded"],
    ));
    skills.push(createSkill(
      equipment,
      "재장전",
      "basic",
      { apCost: 1, windupMs: 700, recoveryMs: 0 },
      "장전 1을 획득합니다.",
      2,
      "피해 없음. 장전 1을 획득합니다.",
      ["ranged", "reload"],
    ));
  } else if (equipment.kind === "staff") {
    skills.push(createSkill(
      equipment,
      equipment.basicName,
      "basic",
      { apCost: 1, windupMs: 300, recoveryMs: 0 },
      "집중 1을 획득합니다.",
      1,
      "피해 없음. 집중 1을 획득합니다.",
      ["magic", "focus"],
    ));
  } else if (isSubweapon) {
    skills.push(createSkill(
      equipment,
      equipment.basicName,
      equipment.kind === "orb" || equipment.kind === "quiver" ? "special" : "guard",
      { apCost: equipment.kind === "orb" ? 0 : 1, windupMs: equipment.kind === "orb" ? 750 : 100, recoveryMs: 0 },
      "보조 장비의 기본 효과를 사용합니다.",
      1,
      `${describeDamage(undefined)} ${BASIC_EFFECTS[equipment.kind] ?? "보조 효과를 사용합니다."}`,
      [equipment.kind, "basic"],
    ));
  } else {
    skills.push(createSkill(
      equipment,
      equipment.basicName,
      "basic",
      ATTACK_VALUES[equipment.kind]!,
      "반복 사용을 전제로 한 기본 기술입니다.",
      1,
      `${describeDamage(ATTACK_VALUES[equipment.kind]!.damageCoefficient)} ${BASIC_EFFECTS[equipment.kind] ?? "기본 효과를 사용합니다."}`,
      [equipment.kind, "basic"],
    ));
  }

  const signatureValues = SIGNATURE_VALUES[equipment.kind] ?? {
    apCost: 2,
    windupMs: 350,
    recoveryMs: 250,
  };
  equipment.signatureNames.forEach((name) => {
    skills.push(createSkill(
      equipment,
      name,
      isSubweapon ? "guard" : "special",
      signatureValues,
      "장비의 시그니처 효과를 사용합니다.",
      skills.length + 1,
      `${describeDamage(signatureValues.damageCoefficient)} ${SIGNATURE_EFFECTS[name] ?? `${equipment.name}의 고유 효과를 사용합니다.`}`,
      [equipment.kind, "signature"],
    ));
  });

  return skills;
};

const createEquipment = (equipment: EquipmentDefinition): EquipmentConfig => ({
  id: equipment.id,
  name: equipment.name,
  kind: equipment.kind,
  rarity: equipment.rarity,
  slot: SUBWEAPON_KINDS.has(equipment.kind) ? "subweapon" : "weapon",
  sellValue: SELL_VALUES[equipment.rarity],
  ...(BASE_ATTACK[equipment.kind] === undefined ? {} : { baseAttack: BASE_ATTACK[equipment.kind] }),
  skills: createSkills(equipment),
});

const EQUIPMENT_DEFINITIONS: readonly EquipmentDefinition[] = [
  { id: "equipment_rusty_sword", name: "녹슨 검", kind: "sword", rarity: "common", basicName: "베기", signatureNames: ["이중 베기"] },
  { id: "equipment_blood_sword", name: "피갈이 검", kind: "sword", rarity: "uncommon", basicName: "베기", signatureNames: ["꿰뚫기"] },
  { id: "equipment_wind_sword", name: "바람결 검", kind: "sword", rarity: "uncommon", basicName: "베기", signatureNames: ["바람 찌르기"] },
  { id: "equipment_duelist_silver_sword", name: "결투가의 은검", kind: "sword", rarity: "rare", basicName: "베기", signatureNames: ["응수 찌르기"] },
  { id: "equipment_pulsing_blood_sword", name: "맥동하는 혈검", kind: "sword", rarity: "rare", basicName: "베기", signatureNames: ["혈수 찌르기"] },
  { id: "equipment_eclipse_sword", name: "월식의 검", kind: "sword", rarity: "epic", basicName: "베기", signatureNames: ["월식 관통"] },
  { id: "equipment_infinite_combo_sword", name: "무한연격검", kind: "sword", rarity: "epic", basicName: "베기", signatureNames: ["끊지 않는 찌르기"] },
  { id: "equipment_oath_eating_knife", name: "서약을 먹는 칼", kind: "sword", rarity: "legendary", basicName: "새기기", signatureNames: ["징수"] },
  { id: "equipment_military_greatsword", name: "군용 파쇄대검", kind: "greatsword", rarity: "uncommon", basicName: "휘두르기", signatureNames: ["내려찍기", "지면 가르기"] },
  { id: "equipment_ash_greatsword", name: "잿빛 대검", kind: "greatsword", rarity: "uncommon", basicName: "휘두르기", signatureNames: ["재 베기", "연무 가르기"] },
  { id: "equipment_earthquake_greatsword", name: "지진 대검", kind: "greatsword", rarity: "rare", basicName: "휘두르기", signatureNames: ["진원 내려찍기", "여진"] },
  { id: "equipment_executioner_blacksteel", name: "처형인의 흑철검", kind: "greatsword", rarity: "rare", basicName: "휘두르기", signatureNames: ["처형", "공포의 횡베기"] },
  { id: "equipment_mountain_cutter", name: "산맥절단검", kind: "greatsword", rarity: "epic", basicName: "휘두르기", signatureNames: ["산 가르기", "낙석"] },
  { id: "equipment_time_knot_greatsword", name: "시간매듭 대검", kind: "greatsword", rarity: "epic", basicName: "휘두르기", signatureNames: ["매듭 절단", "시간 낙하"] },
  { id: "equipment_stopped_noon", name: "멈춘 정오", kind: "greatsword", rarity: "legendary", basicName: "한 박자 늦게", signatureNames: ["정오를 깨뜨려라", "초침을 묻어라"] },
  { id: "equipment_ember_wand", name: "잿불 완드", kind: "wand", rarity: "uncommon", basicName: "마력탄", signatureNames: ["잿불 폭발"] },
  { id: "equipment_frostvein_wand", name: "서리맥 완드", kind: "wand", rarity: "uncommon", basicName: "마력탄", signatureNames: ["빙결 파동"] },
  { id: "equipment_lightning_wand", name: "번개결 완드", kind: "wand", rarity: "rare", basicName: "마력탄", signatureNames: ["연쇄 번개"] },
  { id: "equipment_void_vibration_wand", name: "공허진동 완드", kind: "wand", rarity: "rare", basicName: "마력탄", signatureNames: ["공허 붕괴"] },
  { id: "equipment_seven_flame_wand", name: "일곱불꽃 완드", kind: "wand", rarity: "epic", basicName: "마력탄", signatureNames: ["칠화 폭발"] },
  { id: "equipment_stormheart_wand", name: "폭풍심장 완드", kind: "wand", rarity: "epic", basicName: "마력탄", signatureNames: ["폭풍핵"] },
  { id: "equipment_apprentice_element_staff", name: "수습 원소지팡이", kind: "staff", rarity: "uncommon", basicName: "집중", signatureNames: ["화염 방출", "서리 해방"] },
  { id: "equipment_blue_focus_staff", name: "푸른집중 지팡이", kind: "staff", rarity: "uncommon", basicName: "집중", signatureNames: ["청색 방출", "푸른 장막"] },
  { id: "equipment_primary_color_staff", name: "삼원색 지팡이", kind: "staff", rarity: "rare", basicName: "집중", signatureNames: ["삼색 방출", "색상 혼합"] },
  { id: "equipment_mana_branch_staff", name: "마나분기 지팡이", kind: "staff", rarity: "rare", basicName: "집중", signatureNames: ["분기 방출", "합류 해방"] },
  { id: "equipment_worldtree_staff", name: "세계수 맥동지팡이", kind: "staff", rarity: "epic", basicName: "집중", signatureNames: ["생명 방출", "뿌리 해방"] },
  { id: "equipment_eclipse_record_staff", name: "일식 기록지팡이", kind: "staff", rarity: "epic", basicName: "집중", signatureNames: ["일식 방출", "암전 해방"] },
  { id: "equipment_three_crying_staff", name: "세 번 우는 문장지팡이", kind: "staff", rarity: "legendary", basicName: "점화 점화 방출", signatureNames: ["세 번 울려라", "침묵 뒤의 폭음"] },
  { id: "equipment_poison_fang_bow", name: "독니 장궁", kind: "bow", rarity: "uncommon", basicName: "사격", signatureNames: ["독니 속사", "추적 사격"] },
  { id: "equipment_hunters_longbow", name: "추적자의 장궁", kind: "bow", rarity: "uncommon", basicName: "사격", signatureNames: ["표식 속사", "사냥 마무리"] },
  { id: "equipment_twin_moon_bow", name: "쌍월궁", kind: "bow", rarity: "rare", basicName: "사격", signatureNames: ["반월 속사", "만월 관통"] },
  { id: "equipment_wind_trace_bow", name: "바람궤적궁", kind: "bow", rarity: "rare", basicName: "사격", signatureNames: ["돌풍 속사", "궤적 관통"] },
  { id: "equipment_starfall_longbow", name: "별비 장궁", kind: "bow", rarity: "epic", basicName: "사격", signatureNames: ["별비", "낙성 관통"] },
  { id: "equipment_hunting_end", name: "사냥의 종언", kind: "bow", rarity: "epic", basicName: "사격", signatureNames: ["종언 속사", "마지막 관통"] },
  { id: "equipment_space_swallowing_bow", name: "공백을 삼키는 활", kind: "bow", rarity: "legendary", basicName: "숨 고르고 사격", signatureNames: ["소리 없이 꿰뚫기", "마지막 숨"] },
  { id: "equipment_gear_crossbow", name: "톱니 석궁", kind: "crossbow", rarity: "uncommon", basicName: "발사", signatureNames: ["톱니 연발", "절삭 볼트"] },
  { id: "equipment_gunpowder_crossbow", name: "화약식 석궁", kind: "crossbow", rarity: "uncommon", basicName: "발사", signatureNames: ["폭발 연발", "화약 볼트"] },
  { id: "equipment_echo_crossbow", name: "메아리 석궁", kind: "crossbow", rarity: "rare", basicName: "발사", signatureNames: ["잔향탄", "빈 탄창 반격"] },
  { id: "equipment_auto_crossbow", name: "자동장전 쇠뇌", kind: "crossbow", rarity: "rare", basicName: "발사", signatureNames: ["연속 볼트", "회전 탄창"] },
  { id: "equipment_time_lag_crossbow", name: "시간차 석궁", kind: "crossbow", rarity: "epic", basicName: "발사", signatureNames: ["시차 연발", "정지 볼트"] },
  { id: "equipment_wall_breaker", name: "성벽 파쇄기", kind: "crossbow", rarity: "epic", basicName: "발사", signatureNames: ["공성 연발", "성벽 붕괴"] },
  { id: "equipment_reverser", name: "역행자", kind: "crossbow", rarity: "legendary", basicName: "격사", signatureNames: ["되돌린 탄환", "끝에서 처음으로"] },
  { id: "equipment_crack_mace", name: "균열 철퇴", kind: "mace", rarity: "uncommon", basicName: "강타", signatureNames: ["갑옷 분쇄"] },
  { id: "equipment_pilgrim_mace", name: "순례자 철퇴", kind: "mace", rarity: "uncommon", basicName: "강타", signatureNames: ["참회 타격"] },
  { id: "equipment_rupture_mace", name: "파열 철퇴", kind: "mace", rarity: "rare", basicName: "강타", signatureNames: ["파쇄"] },
  { id: "equipment_bell_tower_mace", name: "종루의 철퇴", kind: "mace", rarity: "rare", basicName: "강타", signatureNames: ["대종 강타"] },
  { id: "equipment_crown_breaker", name: "왕관분쇄자", kind: "mace", rarity: "epic", basicName: "강타", signatureNames: ["왕권 파쇄"] },
  { id: "equipment_thunder_judgment", name: "천둥심판", kind: "mace", rarity: "epic", basicName: "강타", signatureNames: ["낙뢰 분쇄"] },
  { id: "equipment_oak_battle_club", name: "참나무 전투봉", kind: "club", rarity: "uncommon", basicName: "후려치기", signatureNames: ["연속 타격", "기절 강타"] },
  { id: "equipment_nail_club", name: "못박이 몽둥이", kind: "club", rarity: "uncommon", basicName: "후려치기", signatureNames: ["못 연타", "박아넣기"] },
  { id: "equipment_goblin_club", name: "도깨비 방망이", kind: "club", rarity: "rare", basicName: "후려치기", signatureNames: ["도깨비 난타", "대박 강타"] },
  { id: "equipment_combo_manual_club", name: "연타 교본봉", kind: "club", rarity: "rare", basicName: "후려치기", signatureNames: ["교본 연타", "마침표"] },
  { id: "equipment_bone_giant_club", name: "백골 거인봉", kind: "club", rarity: "epic", basicName: "후려치기", signatureNames: ["거인 난타", "골분쇄"] },
  { id: "equipment_laughing_destroyer", name: "웃는 파괴봉", kind: "club", rarity: "epic", basicName: "후려치기", signatureNames: ["광소 난타", "폭소 강타"] },
  { id: "equipment_guard_round_shield", name: "수호병 원형방패", kind: "shield", rarity: "uncommon", basicName: "방패 들기", signatureNames: ["방진 전개"] },
  { id: "equipment_thorn_shield", name: "가시방패", kind: "shield", rarity: "uncommon", basicName: "방패 들기", signatureNames: ["가시 받아치기"] },
  { id: "equipment_mirror_steel_shield", name: "거울강 방패", kind: "shield", rarity: "rare", basicName: "방패 들기", signatureNames: ["거울 반격"] },
  { id: "equipment_fortress_shield", name: "불굴의 탑방패", kind: "shield", rarity: "rare", basicName: "방패 들기", signatureNames: ["성벽 자세"] },
  { id: "equipment_mobile_wall", name: "이동성벽", kind: "shield", rarity: "epic", basicName: "방패 들기", signatureNames: ["전진 방벽"] },
  { id: "equipment_reversal_crest_shield", name: "역전의 문장방패", kind: "shield", rarity: "epic", basicName: "방패 들기", signatureNames: ["문장 역전"] },
  { id: "equipment_bronze_repair_tome", name: "청동 수복 마법서", kind: "tome", rarity: "uncommon", basicName: "보호막", signatureNames: ["수복문"] },
  { id: "equipment_flame_guard_tome", name: "불꽃보호서", kind: "tome", rarity: "uncommon", basicName: "보호막", signatureNames: ["화염 반사"] },
  { id: "equipment_frost_veil_tome", name: "서리장막서", kind: "tome", rarity: "rare", basicName: "보호막", signatureNames: ["빙결 장막"] },
  { id: "equipment_reflection_grammar", name: "반사문법전", kind: "tome", rarity: "rare", basicName: "보호막", signatureNames: ["완전 반사"] },
  { id: "equipment_infinite_pages", name: "무한페이지", kind: "tome", rarity: "epic", basicName: "보호막", signatureNames: ["연속 장막"] },
  { id: "equipment_final_chapter", name: "최후의 장", kind: "tome", rarity: "epic", basicName: "보호막", signatureNames: ["결말 거부"] },
  { id: "equipment_forewarning_orb", name: "예고의 구슬", kind: "orb", rarity: "uncommon", basicName: "명상", signatureNames: ["예고"] },
  { id: "equipment_clear_crystal_orb", name: "맑은 수정구슬", kind: "orb", rarity: "uncommon", basicName: "명상", signatureNames: ["맑은 시야"] },
  { id: "equipment_binocular_orb", name: "쌍안 수정구", kind: "orb", rarity: "rare", basicName: "명상", signatureNames: ["양면 미래"] },
  { id: "equipment_perfect_crystal_orb", name: "무결의 수정 구슬", kind: "orb", rarity: "rare", basicName: "명상", signatureNames: ["결정된 미래"] },
  { id: "equipment_time_observer", name: "시간관측구", kind: "orb", rarity: "epic", basicName: "명상", signatureNames: ["시간 관측"] },
  { id: "equipment_fate_branch_orb", name: "운명분기구", kind: "orb", rarity: "epic", basicName: "명상", signatureNames: ["두 갈래 미래"] },
  { id: "equipment_bloodfeather_quiver", name: "피깃 화살통", kind: "quiver", rarity: "uncommon", basicName: "장전 정비", signatureNames: ["피깃 화살"] },
  { id: "equipment_armorpiercing_quiver", name: "철갑 화살통", kind: "quiver", rarity: "uncommon", basicName: "장전 정비", signatureNames: ["철갑 화살"] },
  { id: "equipment_twin_arrow_quiver", name: "쌍둥이 화살통", kind: "quiver", rarity: "rare", basicName: "장전 정비", signatureNames: ["쌍발 화살"] },
  { id: "equipment_hunters_quiver", name: "사냥꾼 화살통", kind: "quiver", rarity: "rare", basicName: "장전 정비", signatureNames: ["추적 화살"] },
  { id: "equipment_infinite_track_quiver", name: "무한궤도 화살통", kind: "quiver", rarity: "epic", basicName: "장전 정비", signatureNames: ["순환 화살"] },
  { id: "equipment_comet_quiver", name: "혜성의 화살통", kind: "quiver", rarity: "epic", basicName: "장전 정비", signatureNames: ["혜성 화살"] },
];

export const EQUIPMENT_CONFIGS = EQUIPMENT_DEFINITIONS.map(createEquipment);
export const EQUIPMENT_BY_ID = new Map(EQUIPMENT_CONFIGS.map((equipment) => [equipment.id, equipment]));
