import { GameState } from './GameState';

const WORLD_UNLOCKS: Record<number, string[]> = {
  1: ['nitroBoost'],
  2: ['streetCombo'],
  3: ['bodyArmor'],
  4: ['detectiveVision'],
  5: ['witnessShield'],
  6: ['stash'],
  7: ['dogCompanion'],
  8: ['badge'],
};

const ABILITY_DESCRIPTIONS: Record<string, string> = {
  nitroBoost: 'Nitro Boost — Speed burst for 3 seconds',
  streetCombo: 'Street Combo — Chain attacks deal bonus damage',
  bodyArmor: 'Body Armor — Absorb one hit per stage',
  detectiveVision: 'Detective Vision — See enemy patrol routes',
  witnessShield: 'Witness Shield — Civilians block cop shots',
  stash: 'Stash — Store one extra life between worlds',
  dogCompanion: 'Dog Companion — K9 unit fights for you',
  badge: 'Badge — Disguise as a cop (brief immunity)',
};

export class UnlockSystem {
  private static instance: UnlockSystem;

  private constructor() {}

  static getInstance(): UnlockSystem {
    if (!UnlockSystem.instance) {
      UnlockSystem.instance = new UnlockSystem();
    }
    return UnlockSystem.instance;
  }

  getUnlocksForWorld(n: number): string[] {
    return WORLD_UNLOCKS[n] ?? [];
  }

  getAbilityDescription(ability: string): string {
    return ABILITY_DESCRIPTIONS[ability] ?? ability;
  }

  applyUnlock(ability: string): void {
    const state = GameState.getInstance();
    state.unlockAbility(ability);
    console.log(`Unlocked ability: ${ability} — ${this.getAbilityDescription(ability)}`);
  }

  applyWorldUnlocks(worldNumber: number): string[] {
    const abilities = this.getUnlocksForWorld(worldNumber);
    abilities.forEach(ability => this.applyUnlock(ability));
    return abilities;
  }

  getAllAbilityDescriptions(): Array<{ ability: string; description: string }> {
    return Object.entries(ABILITY_DESCRIPTIONS).map(([ability, description]) => ({
      ability,
      description,
    }));
  }
}
