import type { RunState } from "@typing-roguelike/shared";
import { runSession, type RunSession } from "../run/run-session";
import { SCENE_KEYS } from "../scenes/scene-contract";

export type SettlementCompletionSnapshot = Readonly<{
  confirmed: boolean;
  runState: Readonly<RunState>;
}>;

export type SettlementCompletionResult = Readonly<{
  applied: boolean;
  snapshot: SettlementCompletionSnapshot;
  sceneKey: typeof SCENE_KEYS.lobby;
}>;

export class SettlementCompletionController {
  private confirmed = false;

  constructor(
    private readonly runState: Readonly<RunState>,
    private readonly session: RunSession = runSession,
  ) {}

  get snapshot(): SettlementCompletionSnapshot {
    return { confirmed: this.confirmed, runState: this.runState };
  }

  confirm(): SettlementCompletionResult {
    if (this.confirmed) {
      return { applied: false, snapshot: this.snapshot, sceneKey: SCENE_KEYS.lobby };
    }

    this.confirmed = true;
    this.session.clear();
    return { applied: true, snapshot: this.snapshot, sceneKey: SCENE_KEYS.lobby };
  }
}
