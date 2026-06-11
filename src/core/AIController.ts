import type { GameState, TankState } from './GameState';
import { TerrainSystem } from '../systems/TerrainSystem';
import { CONSTANTS } from './GameState';
import { WEAPONS } from './WeaponData';
import type { SolveRequest, SolveResponse } from './aiWorker';

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

// ---- Shared Web Worker (one instance for all AI controllers) ----------------

let sharedWorker: Worker | null = null;
let workerRequestId = 0;
const pendingRequests = new Map<number, (res: SolveResponse) => void>();

function getWorker(): Worker {
    if (!sharedWorker) {
        sharedWorker = new Worker(new URL('./aiWorker.ts', import.meta.url), { type: 'module' });
        sharedWorker.onmessage = (e: MessageEvent<SolveResponse>) => {
            const resolve = pendingRequests.get(e.data.id);
            if (resolve) {
                pendingRequests.delete(e.data.id);
                resolve(e.data);
            }
        };
    }
    return sharedWorker;
}

function solveAsync(req: Omit<SolveRequest, 'id'>): Promise<SolveResponse> {
    return new Promise(resolve => {
        const id = workerRequestId++;
        pendingRequests.set(id, resolve);
        getWorker().postMessage({ ...req, id });
    });
}

// ---- AIController -----------------------------------------------------------

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

    public async decideShot(gameState: GameState, tankIndex: number, terrain: TerrainSystem): Promise<AiDecision> {
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
                power: Math.floor(Math.random() * 5000) + 3000,
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

        // Execute Strategy (off-thread for solver personalities)
        let shot = await this.computeShot(gameState, tank, target, terrain);

        // Use Battery if needed
        if (shot.power > tank.power && (tank.accessories['battery'] || 0) > 0) {
            actions.push('battery');
        }

        // Ensure bounds
        shot.angle = Math.max(0, Math.min(180, shot.angle));
        shot.power = Math.max(0, Math.min(10000, shot.power));

        // Save for Tosser learning
        this.lastShotAngle = shot.angle;
        this.lastShotPower = shot.power;

        return { ...shot, weapon, actions };
    }

    private async computeShot(
        state: GameState,
        tank: TankState,
        target: TankState,
        terrain: TerrainSystem
    ): Promise<{ angle: number; power: number }> {
        switch (this.actualPersonality) {
            case AIPersonality.MORON:
                return this.moronShot();

            case AIPersonality.TOSSER:
                return this.tosserShot(tank, target);

            default:
                return this.solveShot(state, tank, target, terrain);
        }
    }

    private chooseTarget(gameState: GameState, tankIndex: number): TankState | null {
        const tank = gameState.tanks[tankIndex];
        const enemies = gameState.tanks.filter(t => t.id !== tank.id && t.health > 0);
        if (enemies.length === 0) return null;

        if (this.actualPersonality === AIPersonality.CYBORG || this.actualPersonality === AIPersonality.SPOILER) {
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

    private moronShot(): { angle: number; power: number } {
        return {
            angle: Math.floor(Math.random() * 180),
            power: Math.floor(Math.random() * 10000)
        };
    }

    private tosserShot(tank: TankState, target: TankState): { angle: number; power: number } {
        if (this.lastShotAngle === null || this.lastShotPower === null) {
            const dx = target.x - tank.x;
            const dy = target.y - tank.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            return {
                angle: dx > 0 ? 45 : 135,
                power: Math.min(10000, dist * 1.5)
            };
        }

        if (tank.lastShotImpact) {
            const impact = tank.lastShotImpact;
            const targetDist = Math.abs(target.x - tank.x);
            const impactDist = Math.abs(impact.x - tank.x);
            const error = targetDist - impactDist;
            const firingRight = Math.cos(this.lastShotAngle! * Math.PI / 180) > 0;
            const targetRight = target.x > tank.x;

            if (firingRight === targetRight) {
                const step = Math.max(10, Math.abs(error) * 0.5);
                if (impactDist < targetDist) this.lastShotPower += step;
                else this.lastShotPower -= step;
            } else {
                this.lastShotAngle = 180 - this.lastShotAngle!;
            }

            this.lastShotPower += (Math.random() - 0.5) * 10;
            this.lastShotAngle += (Math.random() - 0.5) * 2;
        }

        return { angle: this.lastShotAngle!, power: this.lastShotPower! };
    }

    private async solveShot(
        state: GameState,
        tank: TankState,
        target: TankState,
        terrain: TerrainSystem
    ): Promise<{ angle: number; power: number }> {
        const p = this.actualPersonality;

        // Determine search parameters per personality
        let angleStep = 5;
        let powerSteps = 8;
        let preferLowArc = false;
        let ignoreWind = false;
        let minAngle = 0;
        let maxAngle = 180;

        if (p === AIPersonality.SHOOTER) {
            angleStep = 2; preferLowArc = true; ignoreWind = true;
        } else if (p === AIPersonality.SPOILER || p === AIPersonality.CYBORG) {
            angleStep = 1; powerSteps = 12;
        } else if (p === AIPersonality.CHOOSER) {
            angleStep = 2;
        }

        const weaponStats = WEAPONS[tank.currentWeapon] || WEAPONS['baby_missile'];
        const blastRadius = weaponStats.radius || 20;

        const snapshot = terrain.getSnapshot();
        const baseReq: Omit<SolveRequest, 'id'> = {
            startX: tank.x,
            startY: tank.y - 15,
            targetX: target.x,
            targetY: target.y,
            gravity: state.gravity,
            wind: state.wind,
            borderMode: state.borderMode,
            minAngle,
            maxAngle,
            angleStep,
            powerSteps,
            preferLowArc,
            ignoreWind,
            safeDistance: blastRadius + 25,
            tankX: tank.x,
            tankY: tank.y,
            terrain: snapshot,
            screenWidth: CONSTANTS.SCREEN_WIDTH,
            screenHeight: CONSTANTS.SCREEN_HEIGHT,
        };

        // POOLSHARK: try bounce mirrors first
        if (p === AIPersonality.POOLSHARK && state.borderMode === 'bounce') {
            const [standard, leftMirror, rightMirror] = await Promise.all([
                solveAsync(baseReq),
                solveAsync({ ...baseReq, targetX: -target.x }),
                solveAsync({ ...baseReq, targetX: CONSTANTS.SCREEN_WIDTH + (CONSTANTS.SCREEN_WIDTH - target.x) }),
            ]);

            if (standard.angle !== null && Math.random() > 0.4) {
                return { angle: standard.angle, power: standard.power! };
            }
            if (leftMirror.angle !== null) return { angle: leftMirror.angle, power: leftMirror.power! };
            if (rightMirror.angle !== null) return { angle: rightMirror.angle, power: rightMirror.power! };
            if (standard.angle !== null) return { angle: standard.angle, power: standard.power! };
            return this.moronShot();
        }

        const result = await solveAsync(baseReq);
        if (result.angle !== null) return { angle: result.angle, power: result.power! };
        return this.moronShot();
    }

    private chooseWeapon(tank: TankState, target: TankState, state: GameState): string {
        const dist = Math.abs(target.x - tank.x);
        const enemiesClumped = state.tanks.filter(t => t.id !== tank.id && Math.abs(t.x - target.x) < 80).length > 1;

        if (enemiesClumped && (tank.inventory['nuke'] || 0) > 0) return 'nuke';
        if (enemiesClumped && (tank.inventory['funky_bomb'] || 0) > 0) return 'funky_bomb';
        if (tank.y > 500 && (tank.inventory['riot_blast'] || 0) > 0) return 'riot_blast';
        if (dist > 500 && (tank.inventory['mirv'] || 0) > 0) return 'mirv';
        if ((tank.inventory['nuke'] || 0) > 0) return 'nuke';
        if ((tank.inventory['missile'] || 0) > 0) return 'missile';
        return 'baby_missile';
    }
    
    public makePurchases(tank: TankState): { [itemId: string]: number } {
        const purchases: { [itemId: string]: number } = {};
        const p = this.actualPersonality;
        const funds = tank.credits;

        if ((tank.accessories['shield'] || 0) < 2 && funds > 5000) purchases['shield'] = 2;
        if ((tank.accessories['battery'] || 0) < 2 && funds > 1000) purchases['battery'] = 2;

        if (p === AIPersonality.CYBORG || p === AIPersonality.SPOILER) {
            if (funds > 30000) purchases['lazy_boy'] = 1;
            if (funds > 20000) purchases['nuke'] = 2;
            else if (funds > 5000) purchases['missile'] = 10;
        } else if (p === AIPersonality.POOLSHARK) {
            if (funds > 10000) purchases['leapfrog'] = 5;
            if (funds > 5000) purchases['roller'] = 5;
        } else {
            if (funds > 3000) purchases['missile'] = 5;
        }

        return purchases;
    }
}
