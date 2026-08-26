import type { RunState } from "@typing-roguelike/shared";
import { runSession, type RunSession } from "../run/run-session";

export const persistCompletedRunReward = (
  completedRun: Readonly<RunState>,
  session: RunSession = runSession,
): boolean => {
  if (session.get()?.status !== "active") return false;

  session.update(() => completedRun as RunState);
  session.clearCheckpoint();
  return true;
};
