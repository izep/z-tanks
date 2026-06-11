import type { AIController, AIPersonality } from './AIController';
import type { MarketState } from '../systems/EconomySystem';

export const GamePhase = {
  MENU: 'MENU',
  SETUP: 'SETUP',
  AIMING: 'AIMING',
  FIRING: 'FIRING',
  PROJECTILE_FLYING: 'PROJECTILE_FLYING',
  EXPLOSION: 'EXPLOSION',
  TERRAIN_SETTLING: 'TERRAIN_SETTLING',
  DEATH_SEQUENCE: 'DEATH_SEQUENCE',
  SHOP: 'SHOP',
  GAME_OVER: 'GAME_OVER'
} as const;

export type GamePhase = typeof GamePhase[keyof typeof GamePhase];


export interface TankState {
  id: number;
  name: string;
  x: number;
  y: number;
  vy: number;
  angle: number;
  power: number;
  health: number;
  fuel: number;
  color: string;
  variant: number; // 0-6 sprite index
  isAi: boolean;
  isFalling: boolean;
  parachuteThreshold?: number;
  isDead: boolean; // Queued for death
  credits: number;
  currentWeapon: string;
  inventory: Record<string, number>; // weaponId -> count
  accessories: Record<string, number>; // itemId -> count
  activeShield?: string;
  shieldHealth?: number;
  activeGuidance?: string; // Armed guidance accessory, consumed per shot
  activeTrigger?: boolean; // Contact triggers armed (consumed per shot)
  aiController?: AIController;
  aiPersonality?: AIPersonality;
  hasLanded?: boolean;
  isParachuteDeployed?: boolean;
  teamId?: number; // 0 = no team (FFA)
  lastWords?: string;
  sayTimer?: number;
  lastShotImpact?: { x: number, y: number };
}

export interface ProjectileState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  weaponType: string;
  ownerId: number;
  elapsedTime: number;
  trail: { x: number, y: number }[];
  splitDone?: boolean;
  generation?: number;
  state?: string; // flying, rolling, burrowing
  bounces?: number;
  leapfrogStage?: number; // 0, 1, 2 for sequential warhead tracking
  color?: string;
  guidance?: string; // Guidance system steering this projectile
  contactTrigger?: boolean; // Detonate on first contact (no fizzle/roll)
  deflected?: boolean; // Already kicked by a mag deflector
  // Sandhog warhead properties
  direction?: number; // 1 or -1 for horizontal direction
  tunnelLength?: number;
  distanceRemaining?: number;
  blastRadius?: number;
  damage?: number;
}

export interface ExplosionState {
  id: number;
  x: number;
  y: number;
  maxRadius: number;
  currentRadius: number;
  duration: number;
  elapsed: number;
  color: string;
}

export interface SmokeTrailState {
  id: string;
  points: { x: number, y: number }[];
  color: string;
  createdAt: number;
  duration: number; // ms
}

// Phases where the simulation is running and pausing makes sense
export const PLAY_PHASES: GamePhase[] = [
  GamePhase.AIMING,
  GamePhase.FIRING,
  GamePhase.PROJECTILE_FLYING,
  GamePhase.EXPLOSION,
  GamePhase.TERRAIN_SETTLING,
  GamePhase.DEATH_SEQUENCE
];

export interface GameState {
  phase: GamePhase;
  isPaused?: boolean; // Pause freezes the simulation; never persisted
  tanks: TankState[];
  projectiles: ProjectileState[];
  explosions: ExplosionState[];
  smokeTrails?: SmokeTrailState[]; // Persistent smoke trails
  currentPlayerIndex: number;
  roundNumber: number;
  maxRounds: number;
  wind: number;
  gravity: number; // typically 9.8 * scale
  terrainDirty: boolean; // Flag to check settling
  lastExplosionTime: number;
  borderMode?: 'normal' | 'wrap' | 'bounce' | 'concrete';
  windSetting?: WindSetting; // How wind is rolled each round
  armsLevel?: number; // Shop restriction tier 1-4 (Requirements 2.3)
  interestRate?: number; // Interest on unspent credits between rounds
  talkingTanks?: boolean; // Humorous tank comments (Requirements 3.4)
  marketState?: MarketState; // Economy system state
}

export type WindSetting = 'none' | 'normal' | 'strong';

/** Rolls a new wind value for a round based on the configured setting. */
export function rollWind(setting: WindSetting = 'normal'): number {
  switch (setting) {
    case 'none': return 0;
    case 'strong': return Math.random() * 140 - 70;
    default: return Math.random() * 70 - 35;
  }
}

export const CONSTANTS = {
  SCREEN_WIDTH: 800,
  SCREEN_HEIGHT: 600,
  GRAVITY: 98, // Matches python 9.8 * 10
  FPS: 60,
  MAX_POWER: 1000 // Max firing power at full tank strength (Requirements 1.5)
};

// Max firing power scales with tank strength: 1000 at full health.
// Batteries restore health and therefore the power cap.
export function getMaxPower(tank: Pick<TankState, 'health'>): number {
  return Math.max(0, Math.min(CONSTANTS.MAX_POWER, Math.floor(tank.health * 10)));
}

export const ECONOMY = {
  CREDITS_PER_DAMAGE: 20, // Earned per point of damage dealt to enemies
  KILL_BOUNTY: 5000, // Earned for destroying an enemy tank
  ROUND_WIN_BONUS: 10000, // Awarded to the last tank standing each round
  INTEREST_RATE: 0.10, // Interest on unspent credits between rounds (Requirements 3.2)
  DEFAULT_STARTING_CASH: 10000,
  SELLBACK_RATIO: 0.6, // Fraction of current market price recovered when selling
  MAX_ENERGY_BATTERIES: 3 // Batteries drawn per energy-weapon shot
};
