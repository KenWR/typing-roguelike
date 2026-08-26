import { createInitialRunState, type RunState } from "@typing-roguelike/shared";

export type RunInitializer = (seed: number) => RunState;
export type RunSeedFactory = () => number;

const defaultRunInitializer: RunInitializer = (seed) =>
  createInitialRunState({ seed });

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
}
