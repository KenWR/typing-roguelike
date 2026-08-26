import { describe, expect, test } from "bun:test";
import { createRelicHudEntries } from "../src/game/hud/relic-hud-view";

describe("relic HUD view state", () => {
  test("maps owned relic ids to icon and tooltip presentation", () => {
    expect(
      createRelicHudEntries([
        "relic_echo_charm",
        "relic_whetstone",
        "relic_echo_charm",
      ]),
    ).toEqual([
      {
        id: "relic_echo_charm",
        name: "메아리의 부적",
        rarity: "rare",
        description: "기술 성공 시 15% 확률로 AP를 1 회복합니다. 전투당 최대 2회 발동합니다.",
        textureKey: "relic-icon:relic_echo_charm",
      },
      {
        id: "relic_whetstone",
        name: "숫돌",
        rarity: "common",
        description: "기본기술의 피해가 20% 증가합니다.",
        textureKey: "relic-icon:relic_whetstone",
      },
    ]);
  });

  test("keeps unknown inventory ids visible with a safe explanation", () => {
    expect(createRelicHudEntries(["relic_unknown"])).toEqual([
      {
        id: "relic_unknown",
        name: "relic_unknown",
        rarity: "common",
        description: "등록되지 않은 유물입니다.",
        textureKey: "relic-icon:relic_unknown",
      },
    ]);
  });
});
