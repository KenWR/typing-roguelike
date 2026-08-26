import type { RunState } from "@typing-roguelike/shared";
import { runRemotePersistence } from "../run/run-remote-persistence";
import { initializeRunMap } from "../run/run-start-map";
import { runSession } from "../run/run-session";

export type RunInitializer = (seed: number) => RunState;
export type RunSeedFactory = () => number;

const defaultRunInitializer: RunInitializer = (seed) => {
  const created = runSession.create({ seed });
  const initialized = initializeRunMap(created);
  runSession.update(() => initialized);
  return initialized;
};

const defaultSeedFactory: RunSeedFactory = () => Date.now();

export class LobbyRunStarter {
  private starting = false;

  constructor(
    private readonly initializeRun: RunInitializer = defaultRunInitializer,
    private readonly createSeed: RunSeedFactory = defaultSeedFactory,
  ) {}

  get isStarting(): boolean {
    return this.starting;
  }

  start(): RunState | null {
    if (this.starting) {
      return null;
    }

    this.starting = true;

    try {
      return this.initializeRun(this.createSeed());
    } catch (error) {
      this.starting = false;
      throw error;
    }
  }

  async startPersisted(): Promise<Readonly<RunState> | null> {
    if (this.starting) return null;

    this.starting = true;
    const seed = this.createSeed();

    try {
      const serverRun = await runRemotePersistence.start(seed);
      if (serverRun !== null) {
        return runSession.replace(serverRun);
      }
      return this.initializeRun(seed);
    } catch (error) {
      this.starting = false;
      throw error;
    }
  }
}
