import type { GameState, TankState } from './GameState';
import { TerrainSystem } from '../systems/TerrainSystem';
import { CONSTANTS } from './GameState';
import { WEAPONS } from './WeaponData';

const AI_CONSTANTS = {
    MAX_SCREEN_WIDTH: 800,
    MAX_POWER: 1000,
    SIMULATION_STEP: 1 / 60, // Physics step
    SIMULATION_MAX_TIME: 10, // Max flight time to simulate
};

export const AIPersonality = {
    MORON: 'MORON',
    SHOOTER: 'SHOOTER',
    POOLSHARK: 'POOLSHARK',
    TOSSER: 'TOSSER',
    CHOOSER: 'CHOOSER',
    SPOILER: 'SPOILER',
    CYBORG: 'CYBORG',
    UNKNOWN: 'UNKNOWN'
} as const;

export type AIPersonality = typeof AIPersonality[keyof typeof AIPersonality];

export interface AiDecision {
    angle: number;
    power: number;
    weapon: string;
    actions: ('shield' | 'battery')[];
}

export class AIController {
    public personality: AIPersonality;
    private actualPersonality: AIPersonality;

    // Tosser learning
    private lastShotAngle: number | null = null;
    private lastShotPower: number | null = null;
    private lastTargetId: number | null = null;

    constructor(personality: AIPersonality) {
        this.personality = personality;
        this.actualPersonality = personality;

        if (personality === AIPersonality.UNKNOWN) {
            const keys = Object.values(AIPersonality).filter(p => p !== AIPersonality.UNKNOWN);
            this.actualPersonality = keys[Math.floor(Math.random() * keys.length)];
        }
    }

    public decideShot(gameState: GameState, tankIndex: number, terrain: TerrainSystem): AiDecision {
        const tank = gameState.tanks[tankIndex];
        const target = this.chooseTarget(gameState, tankIndex);
        const actions: ('shield' | 'battery')[] = [];

        // Defense Strategy
        if (tank.health < 40 && (tank.accessories['shield'] || 0) > 0 && !tank.activeShield) {
            actions.push('shield');
        }

        if (!target) {
            return {
                angle: Math.floor(Math.random() * 120) + 30,
                power: Math.floor(Math.random() * 500) + 300,
                weapon: 'baby_missile',
                actions
            };
        }

        // Reset learning if target changed
        if (this.lastTargetId !== target.id) {
            this.lastShotAngle = null;
            this.lastShotPower = null;
            this.lastTargetId = target.id;
        }

        // Weapon Selection
        const weapon = this.chooseWeapon(tank, target, gameState);
        tank.currentWeapon = weapon;

        // Execute Strategy
        let shot = { angle: 45, power: 500 };
        switch (this.actualPersonality) {
            case AIPersonality.MORON: 
                shot = this.moronShot(); break;
            case AIPersonality.SHOOTER: 
                shot = this.shooterShot(gameState, tank, target, terrain); break;
            case AIPersonality.POOLSHARK: 
                shot = this.poolsharkShot(gameState, tank, target, terrain); break;
            case AIPersonality.TOSSER: 
                shot = this.tosserShot(tank, target); break;
            case AIPersonality.CHOOSER: 
                shot = this.chooserShot(gameState, tank, target, terrain); break;
            case AIPersonality.SPOILER: 
                shot = this.spoilerShot(gameState, tank, target, terrain); break;
            case AIPersonality.CYBORG: 
                shot = this.cyborgShot(gameState, tank, target, terrain); break;
        }

        // Use Battery if needed
        if (shot.power > tank.power && (tank.accessories['battery'] || 0) > 0) {
            actions.push('battery');
        }

        // Ensure bounds
        shot.angle = Math.max(0, Math.min(180, shot.angle));
        shot.power = Math.max(0, Math.min(1000, shot.power));

        // Save for Tosser learning
        this.lastShotAngle = shot.angle;
        this.lastShotPower = shot.power;

        return { ...shot, weapon, actions };
    }

    private chooseTarget(gameState: GameState, tankIndex: number): TankState | null {
        const tank = gameState.tanks[tankIndex];
        const enemies = gameState.tanks.filter((t, i) => i !== tankIndex && t.health > 0);
        if (enemies.length === 0) return null;

        if (this.actualPersonality === AIPersonality.CYBORG || this.actualPersonality === AIPersonality.SPOILER) {
            // Prioritize weakest or richest, but also consider ease of hit
            return enemies.reduce((prev, curr) => {
                const prevScore = (100 - prev.health) + (prev.credits / 50);
                const currScore = (100 - curr.health) + (curr.credits / 50);
                return currScore > prevScore ? curr : prev;
            });
        }
        
        // Default: Closest
        return enemies.reduce((closest, current) => {
            const d1 = Math.abs(closest.x - tank.x);
            const d2 = Math.abs(current.x - tank.x);
            return d2 < d1 ? current : closest;
        });
    }

    // --- Strategies ---

    private moronShot(): { angle: number, power: number } {
        return {
            angle: Math.floor(Math.random() * 180),
            power: Math.floor(Math.random() * 1000)
        };
    }

    private shooterShot(state: GameState, tank: TankState, target: TankState, terrain: TerrainSystem): { angle: number, power: number } {
        // Try direct line of sight (low angle)
        const solution = this.solveTrajectory(state, tank, target, terrain, {
            minAngle: 0,
            maxAngle: 180,
            angleStep: 2,
            preferLowArc: true,
            ignoreWind: true // Shooter ignores wind (handicap)
        });
        
        if (solution) return solution;
        return this.moronShot(); // Fallback
    }

    private poolsharkShot(state: GameState, tank: TankState, target: TankState, terrain: TerrainSystem): { angle: number, power: number } {
        // Check if rebound is possible
        if (state.borderMode === 'bounce') {
            // Try Standard
             let solution = this.solveTrajectory(state, tank, target, terrain);
             if (solution && Math.random() > 0.4) return solution; // 60% chance to prefer fancy shot

            // Try Virtual Targets (Mirror)
            // Left Wall Mirror
            const virtualLeft = { ...target, x: -target.x };
            // Right Wall Mirror
            const virtualRight = { ...target, x: CONSTANTS.SCREEN_WIDTH + (CONSTANTS.SCREEN_WIDTH - target.x) };

            const sLeft = this.solveTrajectory(state, tank, virtualLeft, terrain);
            if (sLeft) return sLeft;

            const sRight = this.solveTrajectory(state, tank, virtualRight, terrain);
            if (sRight) return sRight;
            
            if (solution) return solution;
        }

        return this.shooterShot(state, tank, target, terrain);
    }

    private tosserShot(tank: TankState, target: TankState): { angle: number, power: number } {
        // Init if null
        if (this.lastShotAngle === null || this.lastShotPower === null) {
            // Start with a guess
            const dx = target.x - tank.x;
            const dy = target.y - tank.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            return {
                angle: dx > 0 ? 45 : 135,
                power: Math.min(1000, dist * 1.5) // Crude guess
            };
        }

        // Adjust based on last miss
        if (tank.lastShotImpact) {
            const impact = tank.lastShotImpact;
            // Simple heuristic: adjust power for distance
            const targetDist = Math.abs(target.x - tank.x);
            const impactDist = Math.abs(impact.x - tank.x);
            const error = targetDist - impactDist;

            // If we overshot (impact further than target), reduce power
            // If we undershot, increase power
            // Direction matters
            const firingRight = Math.cos(this.lastShotAngle! * Math.PI / 180) > 0;
            const targetRight = target.x > tank.x;

            // If we fired in correct direction
            if (firingRight === targetRight) {
                // Heuristic: Power is roughly proportional to sqrt(distance)
                // New Power = Old Power * (TargetDist / ImpactDist)^0.5 ?
                // Let's use simpler stepping for "Tosser" feel
                const step = Math.max(10, Math.abs(error) * 0.5);
                
                if (impactDist < targetDist) {
                    this.lastShotPower += step;
                } else {
                    this.lastShotPower -= step;
                }
            } else {
                // Wrong direction? Flip angle
                this.lastShotAngle = 180 - this.lastShotAngle!;
            }

            // Random jitter
            this.lastShotPower += (Math.random() - 0.5) * 10;
            this.lastShotAngle += (Math.random() - 0.5) * 2;
        }

        return { angle: this.lastShotAngle!, power: this.lastShotPower! };
    }

    private chooserShot(state: GameState, tank: TankState, target: TankState, terrain: TerrainSystem): { angle: number, power: number } {
        // Chooser tries to pick the "safest" shot (high arc usually avoids obstacles)
        return this.solveTrajectory(state, tank, target, terrain, {
             minAngle: 0, maxAngle: 180, angleStep: 2, preferLowArc: false
        }) || this.moronShot();
    }

    private spoilerShot(state: GameState, tank: TankState, target: TankState, terrain: TerrainSystem): { angle: number, power: number } {
        // Accurately finds shot
        const solution = this.solveTrajectory(state, tank, target, terrain, {
            minAngle: 0,
            maxAngle: 180,
            angleStep: 1, // High precision
            preferLowArc: false
        });

        if (solution) return solution;
        return this.moronShot();
    }

    private cyborgShot(state: GameState, tank: TankState, target: TankState, terrain: TerrainSystem): { angle: number, power: number } {
        // Cyborg is ruthless. Uses precision.
        return this.spoilerShot(state, tank, target, terrain);
    }

    // --- Core Solver ---

    private solveTrajectory(
        state: GameState, 
        tank: TankState, 
        target: TankState, 
        terrain: TerrainSystem,
        opts: { minAngle: number, maxAngle: number, angleStep: number, preferLowArc?: boolean, ignoreWind?: boolean } = { minAngle: 0, maxAngle: 180, angleStep: 5 }
    ): { angle: number, power: number } | null {

        const { gravity } = state;
        const wind = opts.ignoreWind ? 0 : state.wind;
        const startX = tank.x;
        const startY = tank.y - 15; // Muzzle
        
        const weaponStats = WEAPONS[tank.currentWeapon] || WEAPONS['baby_missile'];
        const blastRadius = weaponStats.radius || 20;
        const safeDistance = blastRadius + 25; // Buffer

        // Direction logic
        const dx = target.x - tank.x;
        const targetIsRight = dx > 0;
        
        let searchMin = targetIsRight ? 0 : 80;
        let searchMax = targetIsRight ? 100 : 180;
        
        searchMin = Math.max(opts.minAngle, searchMin);
        searchMax = Math.min(opts.maxAngle, searchMax);

        const angles: number[] = [];
        for (let a = searchMin; a <= searchMax; a += opts.angleStep) angles.push(a);

        if (opts.preferLowArc) {
            const ideal = targetIsRight ? 0 : 180;
            angles.sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal));
        } else {
            angles.sort((a, b) => Math.abs(a - 90) - Math.abs(b - 90));
        }

        const powerSteps = (this.actualPersonality === AIPersonality.CYBORG || this.actualPersonality === AIPersonality.SPOILER) ? 12 : 8;
        let bestMiss: { angle: number, power: number, dist: number } | null = null;

        for (const angle of angles) {
            let low = 0;
            let high = 1000;
            
            for (let i = 0; i < powerSteps; i++) {
                const power = (low + high) / 2;
                const result = this.simulateShot(startX, startY, angle, power, gravity, wind, terrain, target, state.borderMode);

                if (result.hitTarget) {
                    // Safety Check: Did we hit too close to ourselves?
                    const impactDist = Math.sqrt(Math.pow(result.x - tank.x, 2) + Math.pow(result.y - tank.y, 2));
                    if (impactDist > safeDistance) {
                        return { angle, power }; 
                    }
                    // Else: Hit but unsafe. Treat as not found (continue search)
                }

                if (result.minDist !== undefined) {
                    // Only consider safe misses as fallback candidates
                    const missImpactDist = Math.sqrt(Math.pow(result.x - tank.x, 2) + Math.pow(result.y - tank.y, 2));
                    if (missImpactDist > safeDistance) {
                        if (!bestMiss || result.minDist < bestMiss.dist) {
                            bestMiss = { angle, power, dist: result.minDist };
                        }
                    }
                }

                if (result.overshot) {
                    high = power;
                } else {
                    low = power;
                }
            }
        }

        if ((this.actualPersonality === AIPersonality.CYBORG || this.actualPersonality === AIPersonality.SPOILER) && bestMiss) {
            return { angle: bestMiss.angle, power: bestMiss.power };
        }

        return null;
    }

    private simulateShot(
        x0: number, y0: number, 
        angleDeg: number, power: number, 
        gravity: number, wind: number, 
        terrain: TerrainSystem,
        target: TankState,
        borderMode?: string
    ): { hitTarget: boolean, overshot: boolean, hitTerrain: boolean, minDist?: number, x: number, y: number } {
        
        const rad = angleDeg * (Math.PI / 180);
        const speed = power * 0.5;
        let vx = Math.cos(rad) * speed;
        let vy = -Math.sin(rad) * speed;
        let x = x0;
        let y = y0;

        const dt = AI_CONSTANTS.SIMULATION_STEP;
        const targetRadius = 25; 

        const handleWrap = () => {
             if (x < 0) x += CONSTANTS.SCREEN_WIDTH;
             else if (x > CONSTANTS.SCREEN_WIDTH) x -= CONSTANTS.SCREEN_WIDTH;
        };

        const direction = target.x > x0 ? 1 : -1;
        let minDist = Infinity;

        for (let t = 0; t < AI_CONSTANTS.SIMULATION_MAX_TIME; t += dt) {
            vx += wind * dt * 6;
            vy += gravity * dt * 10;
            x += vx * dt;
            y += vy * dt;

            if (borderMode === 'wrap') handleWrap();
            if (borderMode === 'bounce') {
                if (x < 0 || x > CONSTANTS.SCREEN_WIDTH) {
                     vx = -vx * 0.8;
                     x = Math.max(0, Math.min(CONSTANTS.SCREEN_WIDTH, x));
                }
            }
            if (borderMode === 'concrete' || borderMode === 'normal') {
                if (x < 0 || x > CONSTANTS.SCREEN_WIDTH) return { hitTarget: false, overshot: true, hitTerrain: false, minDist, x, y };
            }

            const dx = x - target.x;
            const dy = y - (target.y - 10);
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < minDist) minDist = dist;

            if (dist < targetRadius) {
                return { hitTarget: true, overshot: false, hitTerrain: false, minDist, x, y };
            }

            if (y > target.y + 100 && vy > 0) {
                 const distX = (x - target.x) * direction;
                 return { hitTarget: false, overshot: distX > 0, hitTerrain: true, minDist, x, y };
            }

            if (terrain.isSolid(x, y) || y > CONSTANTS.SCREEN_HEIGHT) {
                 const distX = (x - target.x) * direction;
                 return { hitTarget: false, overshot: distX > 0, hitTerrain: true, minDist, x, y };
            }
        }

        const finalDist = (x - target.x) * direction;
        return { hitTarget: false, overshot: finalDist > 0, hitTerrain: false, minDist, x, y };
    }

    private chooseWeapon(tank: TankState, target: TankState, state: GameState): string {
        const dist = Math.abs(target.x - tank.x);
        const enemiesClumped = state.tanks.filter(t => t.id !== tank.id && Math.abs(t.x - target.x) < 80).length > 1;

        // Logic for specialized weapons
        if (enemiesClumped && tank.inventory['nuke'] && tank.inventory['nuke'] > 0) return 'nuke';
        if (enemiesClumped && tank.inventory['funky_bomb'] && tank.inventory['funky_bomb'] > 0) return 'funky_bomb';

        // Use terrain weapons?
        if (tank.y > 500 && tank.inventory['riot_blast'] && tank.inventory['riot_blast'] > 0) return 'riot_blast'; // Clear dirt

        // Standard logic
        if (dist > 500 && tank.inventory['mirv'] && tank.inventory['mirv'] > 0) return 'mirv';
        
        // Fallback to strongest standard
        if (tank.inventory['nuke'] && tank.inventory['nuke'] > 0) return 'nuke';
        if (tank.inventory['missile'] && tank.inventory['missile'] > 0) return 'missile';
        
        return 'baby_missile';
    }
    
    public makePurchases(tank: TankState): { [itemId: string]: number } {
        const purchases: { [itemId: string]: number } = {};
        const p = this.actualPersonality;
        const funds = tank.credits;

        // Essentials
        if (tank.accessories['shield'] === undefined || tank.accessories['shield'] < 2) {
             if (funds > 5000) purchases['shield'] = 2;
        }
        if (tank.accessories['battery'] === undefined || tank.accessories['battery'] < 2) {
             if (funds > 1000) purchases['battery'] = 2;
        }

        // Personality Buying
        if (p === AIPersonality.CYBORG || p === AIPersonality.SPOILER) {
            if (funds > 30000) purchases['lazy_boy'] = 1;
            if (funds > 20000) purchases['nuke'] = 2;
            else if (funds > 5000) purchases['missile'] = 10;
        } else if (p === AIPersonality.POOLSHARK) {
            if (funds > 10000) purchases['leapfrog'] = 5;
            if (funds > 5000) purchases['roller'] = 5;
        } else {
             // Generic
             if (funds > 3000) purchases['missile'] = 5;
        }

        return purchases;
    }
}