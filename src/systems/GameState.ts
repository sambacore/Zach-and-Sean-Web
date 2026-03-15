const STORAGE_KEY = 'zachAndSeanVsCops_save';

interface SaveData {
  selectedCharacter: 'zach' | 'sean' | null;
  worldsBeaten: number[];
  unlockedAbilities: string[];
  choices: Record<number, string>;
}

export class GameState {
  private static instance: GameState;

  selectedCharacter: 'zach' | 'sean' | null = null;
  worldsBeaten: Set<number> = new Set();
  unlockedAbilities: Set<string> = new Set();
  choices: Record<number, string> = {};

  private constructor() {
    this.load();
  }

  static getInstance(): GameState {
    if (!GameState.instance) {
      GameState.instance = new GameState();
    }
    return GameState.instance;
  }

  save(): void {
    const data: SaveData = {
      selectedCharacter: this.selectedCharacter,
      worldsBeaten: Array.from(this.worldsBeaten),
      unlockedAbilities: Array.from(this.unlockedAbilities),
      choices: this.choices,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Could not save game state:', e);
    }
  }

  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data: SaveData = JSON.parse(raw);
      this.selectedCharacter = data.selectedCharacter ?? null;
      this.worldsBeaten = new Set(data.worldsBeaten ?? []);
      this.unlockedAbilities = new Set(data.unlockedAbilities ?? []);
      this.choices = data.choices ?? {};
    } catch (e) {
      console.warn('Could not load game state:', e);
    }
  }

  reset(): void {
    this.selectedCharacter = null;
    this.worldsBeaten = new Set();
    this.unlockedAbilities = new Set();
    this.choices = {};
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Could not reset game state:', e);
    }
  }

  setCharacter(char: 'zach' | 'sean'): void {
    this.selectedCharacter = char;
    this.save();
  }

  beatWorld(n: number): void {
    this.worldsBeaten.add(n);
    this.save();
  }

  makeChoice(world: number, choice: string): void {
    this.choices[world] = choice;
    this.save();
  }

  hasAbility(ability: string): boolean {
    return this.unlockedAbilities.has(ability);
  }

  unlockAbility(ability: string): void {
    this.unlockedAbilities.add(ability);
    this.save();
  }
}
