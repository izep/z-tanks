import { type GameState, GamePhase, type ProjectileState, type TankState, CONSTANTS, ECONOMY, getMaxPower } from '../core/GameState';
import { TerrainSystem } from './TerrainSystem';
import { WEAPONS } from '../core/WeaponData';
import { SoundManager } from '../core/SoundManager';
import { tankSay } from '../core/TankTalk';
import {
    type BorderStrategy,
    DefaultBorderStrategy,
    BorderAction
} from './physics/BorderStrategy';
import {
    type WeaponBehavior,
    StandardFlightBehavior,
    ParticleBehavior,
    RollingBehavior,
    DiggingBehavior,
    SandhogBehavior,
    SandhogWarheadBehavior,
    LeapfrogBehavior,
    LiquidBehavior,
    NapalmBehavior,
    type PhysicsContext
} from './physics/WeaponBehavior';

// Simple, fast ID generator for particles and projectiles.
// Using a closure so the counter is scoped to this module instance and resets
// cleanly on Vite HMR without leaking into other module instances.
let nextId = 0;
export const generateId = () => (nextId++).toString();
export const resetIdCounter = () => { nextId = 0; };

// Tank collision constants
const TANK_COLLISION_RADIUS = 15;
const TANK_COLLISION_RADIUS_SQ = TANK_COLLISION_RADIUS * TANK_COLLISION_RADIUS;
const TANK_CENTER_Y_OFFSET = 10;
const TANK_DAMAGE_RADIUS_BUFFER = 10;

export class PhysicsSystem {
    private terrainSystem: TerrainSystem;
    private soundManager: SoundManager;

    // Strategies & Behaviors
    private borderStrategy: BorderStrategy;
    private standardBehavior: StandardFlightBehavior;
    private particleBehavior: ParticleBehavior;
    private rollingBehavior: RollingBehavior;
    private diggingBehavior: DiggingBehavior;
    private sandhogBehavior: SandhogBehavior;
    private sandhogWarheadBehavior: SandhogWarheadBehavior;
    private leapfrogBehavior: LeapfrogBehavior;
    private liquidBehavior: LiquidBehavior;
    private napalmBehavior: NapalmBehavior;

    constructor(terrainSystem: TerrainSystem, soundManager: SoundManager) {
        this.terrainSystem = terrainSystem;
        this.soundManager = soundManager;

        // Default Config (Can be changed at runtime if needed)
        this.borderStrategy = new DefaultBorderStrategy();

        // Initialize Behaviors
        this.standardBehavior = new StandardFlightBehavior();
        this.particleBehavior = new ParticleBehavior();
        this.rollingBehavior = new RollingBehavior();
        this.diggingBehavior = new DiggingBehavior();
        this.sandhogBehavior = new SandhogBehavior();
        this.sandhogWarheadBehavior = new SandhogWarheadBehavior();
        this.leapfrogBehavior = new LeapfrogBehavior();
        this.liquidBehavior = new LiquidBehavior();
        this.napalmBehavior = new NapalmBehavior();
    }

    public setBorderStrategy(strategy: BorderStrategy) {
        this.borderStrategy = strategy;
    }

    public update(state: GameState, dt: number) {
        // 1. Update Projectiles
        if (state.phase === GamePhase.PROJECTILE_FLYING) {
            this.updateProjectiles(state, dt);
        }

        // 2. Update Tanks (Falling)
        this.updateTanks(state, dt);

        // 3. Update Explosions
        this.updateExplosions(state, dt);

        // 4. Update Talking Timers
        state.tanks.forEach(t => {
            if (t.sayTimer && t.sayTimer > 0) {
                t.sayTimer -= dt;
            }
        });
    }

    private updateProjectiles(state: GameState, dt: number) {
        const toRemove: number[] = [];
        const newQueue: any[] = []; // Temporary queue for new projectiles

        // Context for behaviors
        const context: PhysicsContext = {
            terrainSystem: this.terrainSystem,
            soundManager: this.soundManager,
            triggerExplosion: (s, x, y, p, q) => this.triggerExplosion(s, x, y, p, q),
            addProjectile: (p) => newQueue.push(p),
            applyTankDamage: (s, t, d, a) => this.applyTankDamage(s, t, d, a)
        };

        state.projectiles.forEach((proj, index) => {
            // 1. Select Behavior
            const behavior = this.getBehavior(proj);

            // 2. Update (returns true if behavior requested removal)
            let shouldRemove = behavior.update(proj, state, dt, context);

            // Mag Deflectors kick enemy projectiles away (one impulse each)
            if (!shouldRemove && !proj.deflected) {
                this.applyMagDeflection(state, proj);
            }

            // 3. Border Check (if not already removed)
            if (!shouldRemove) {
                const borderAction = this.borderStrategy.check(proj);
                if (borderAction !== BorderAction.NONE) {
                    if (borderAction === BorderAction.EXPLODE) {
                        // Explode at current position (at the edge)
                        this.triggerExplosion(state, proj.x, proj.y, proj, newQueue);
                        shouldRemove = true;
                    } else {
                        // Apply strategy (Bounce, Wrap, Destroy)
                        shouldRemove = this.borderStrategy.apply(proj, borderAction);
                    }
                }
            }

            // 4. Collision Check (Standard & Rolling)
            // Diggers, Sandhogs, and warheads handle their own collision in behavior
            // Particles handle their own collision/ground check in behavior
            // Bouncers (Leapfrog) handle their own collision in behavior
            // Liquid/Napalm handles its own collision in behavior
            // Rollers in rolling state handle their own collision in behavior
            if (!shouldRemove &&
                !this.isParticle(proj.weaponType) &&
                !this.isDigger(proj.weaponType) &&
                !this.isSandhog(proj.weaponType) &&
                !this.isBouncer(proj.weaponType) &&
                proj.state !== 'rolling' &&
                proj.weaponType !== 'liquid_dirt_particle' &&
                proj.weaponType !== 'napalm_particle' &&
                proj.weaponType !== 'sandhog_warhead' &&
                proj.weaponType !== 'tracer' &&
                proj.weaponType !== 'smoke_tracer') {
                // Check Collision
                if (this.checkCollision(state, proj)) {
                    // Special Handling for Rollers (Start Rolling)
                    // Contact triggers make rollers detonate on touch instead
                    if (this.isRoller(proj.weaponType) && !proj.contactTrigger) {
                        this.startRolling(proj);
                    } else if (WEAPONS[proj.weaponType]?.type === 'mirv' && !proj.splitDone && !proj.contactTrigger) {
                        // MIRV/Death's Head fizzle if they hit before reaching
                        // apogee — unless armed with a contact trigger
                        shouldRemove = true;
                    } else {
                        shouldRemove = true;
                        // Trigger Explosion
                        this.triggerExplosion(state, proj.x, proj.y, proj, newQueue);
                    }
                }
            }

            // Tracer collision handling (no explosion)
            if ((proj.weaponType === 'tracer' || proj.weaponType === 'smoke_tracer') &&
                this.checkCollision(state, proj)) {
                shouldRemove = true;
                
                // Smoke tracer: save trail persistently
                if (proj.weaponType === 'smoke_tracer' && proj.trail.length > 0) {
                    const weaponStats = WEAPONS['smoke_tracer'];
                    if (!state.smokeTrails) state.smokeTrails = [];
                    state.smokeTrails.push({
                        id: proj.id,
                        points: [...proj.trail],
                        color: weaponStats.trailColor || '#00FF00',
                        createdAt: Date.now(),
                        duration: weaponStats.trailDuration || 4000
                    });
                }
            }

            // Update Trail
            proj.trail.push({ x: proj.x, y: proj.y });
            const maxTrail = proj.weaponType === 'tracer' ? 300 : 50;
            if (proj.trail.length > maxTrail) proj.trail.shift();

            if (shouldRemove) {
                toRemove.push(index);
            }
        });

        // Add new projectiles
        if (newQueue.length > 0) {
            state.projectiles.push(...newQueue);
        }

        // Remove projectiles
        if (toRemove.length > 0) {
            let writeIdx = 0;
            let removePtr = 0;
            for (let readIdx = 0; readIdx < state.projectiles.length; readIdx++) {
                if (removePtr < toRemove.length && readIdx === toRemove[removePtr]) {
                    // Skip this element
                    removePtr++;
                } else {
                    // Keep this element
                    if (readIdx !== writeIdx) {
                        state.projectiles[writeIdx] = state.projectiles[readIdx];
                    }
                    writeIdx++;
                }
            }
            state.projectiles.length = writeIdx;
        }

        // Clean up old smoke trails
        if (state.smokeTrails && state.smokeTrails.length > 0) {
            const now = Date.now();
            state.smokeTrails = state.smokeTrails.filter(trail => 
                (now - trail.createdAt) < trail.duration
            );
        }

        // Check for phase change
        // If no projectiles left, turn is over.
        if (state.projectiles.length === 0) {
            state.phase = GamePhase.EXPLOSION;
            state.lastExplosionTime = performance.now();
        }
    }

    private getBehavior(proj: ProjectileState): WeaponBehavior {
        if (proj.state === 'rolling') return this.rollingBehavior;
        if (proj.weaponType === 'liquid_dirt_particle') return this.liquidBehavior;
        if (proj.weaponType === 'napalm_particle') return this.napalmBehavior;
        if (proj.weaponType === 'sandhog_warhead') return this.sandhogWarheadBehavior;
        if (this.isParticle(proj.weaponType)) return this.particleBehavior;
        if (this.isSandhog(proj.weaponType)) return this.sandhogBehavior;
        if (this.isDigger(proj.weaponType)) return this.diggingBehavior;
        if (this.isBouncer(proj.weaponType)) return this.leapfrogBehavior;
        return this.standardBehavior;
    }

    private isBouncer(type: string): boolean {
        return WEAPONS[type]?.type === 'bouncer';
    }

    private isParticle(type: string): boolean {
        return type === 'dirt_particle' || type === 'riot_particle';
    }

    private isDigger(type: string): boolean {
        return type === 'digger' || type === 'baby_digger' || type === 'heavy_digger';
    }

    private isSandhog(type: string): boolean {
        return type === 'sandhog' || type === 'baby_sandhog' || type === 'heavy_sandhog';
    }

    private isRoller(weaponType: string): boolean {
        const weaponStats = WEAPONS[weaponType];
        return weaponStats?.type === 'roller';
    }

    private startRolling(proj: ProjectileState) {
        proj.state = 'rolling';
        // Dampen velocity
        proj.vx *= 0.8;
        proj.vy = 0;

        const groundY = this.terrainSystem.getGroundY(Math.floor(proj.x));
        proj.y = groundY;

        // Nudge
        if (Math.abs(proj.vx) < 10) {
            proj.vx = (proj.vx >= 0 ? 1 : -1) * 20;
        }
    }

    private checkCollision(state: GameState, proj: any): boolean {
        // 1. Terrain Collision
        const y = Math.floor(proj.y);
        const x = Math.floor(proj.x);

        // Sky check (handled by border strategy mostly, but checkCollision is for Impact)
        if (y < 0) return false;

        // Border Strategy handles Out of Bounds (Bottom/Sides), but here we check for TERRAIN hit.
        // If y > SCREEN_HEIGHT, it's a hit (handled by BorderStrategy -> Destroy, but strictly speaking it's a "collision" with floor)
        if (y >= CONSTANTS.SCREEN_HEIGHT) return true;

        if (this.isDigger(proj.weaponType) || this.isSandhog(proj.weaponType)) return false; // Diggers and Sandhogs don't collide with terrain surface

        // Check exact pixel solidity (allows tunnels)
        if (this.terrainSystem.isSolid(x, y)) return true;

        // 2. Tank Collision
        for (const tank of state.tanks) {
            if (tank.health <= 0) continue;
            const dx = proj.x - tank.x;
            const dy = proj.y - (tank.y - TANK_CENTER_Y_OFFSET);
            const distSq = dx * dx + dy * dy;
            if (distSq < TANK_COLLISION_RADIUS_SQ) return true;
        }

        return false;
    }

    // Exposed for Context
    public triggerExplosion(state: GameState, x: number, y: number, proj?: any, newQueue?: any[]) {
        if (proj) {
            const owner = state.tanks.find(t => t.id === proj.ownerId);
            if (owner) {
                owner.lastShotImpact = { x: x, y: y };
            }
        }

        const weaponId = proj?.weaponType || 'missile';
        const weaponStats = WEAPONS[weaponId] || WEAPONS['missile'];
        const radius = weaponStats.radius;

        // --- Explosion Logic based on Type ---
        if (weaponStats.type === 'dirt_charge') {
            this.terrainSystem.addTerrain(state, x, y, radius);
        } else if (weaponStats.type === 'liquid_dirt') {
            // Spawn Liquid Dirt Particles - Splash / Ooze Effect
            if (newQueue) {
                const count = 200;
                for (let i = 0; i < count; i++) {
                    // Random spread around impact
                    const offsetX = (Math.random() - 0.5) * 80; // +/- 40px spread
                    const startX = x + offsetX;
                    
                    // Initial velocity: mostly random spread ("splash")
                    const vx = (Math.random() - 0.5) * 100; // +/- 50
                    const vy = (Math.random() - 0.5) * 20; // +/- 10

                    newQueue.push({
                        id: generateId(),
                        x: startX,
                        y: y - 2, // Slightly above ground
                        vx: vx,
                        vy: vy,
                        weaponType: 'liquid_dirt_particle',
                        ownerId: proj.ownerId,
                        elapsedTime: 0,
                        trail: []
                    });
                }
            }
        } else if (weaponStats.type === 'napalm' && newQueue) {
            // Spawn Napalm Particles - Splash / Burning Flow
            const count = 150; // High count for spread
            for (let i = 0; i < count; i++) {
                // Random spread around impact
                const offsetX = (Math.random() - 0.5) * 80; 
                const startX = x + offsetX;
                
                // Splash velocity
                const vx = (Math.random() - 0.5) * 100;
                const vy = (Math.random() - 0.5) * 20;

                newQueue.push({
                    id: generateId(),
                    x: startX,
                    y: y - 5,
                    vx: vx,
                    vy: vy,
                    weaponType: 'napalm_particle',
                    ownerId: proj.ownerId || -1,
                    elapsedTime: 0,
                    trail: []
                });
            }
            this.terrainSystem.explode(state, x, y, 20); // Initial blast
        } else if (weaponStats.type === 'riot_charge' || weaponStats.type === 'dirt_destroyer') {
            this.terrainSystem.explode(state, x, y, radius);
        } else if (weaponStats.type === 'earth_disrupter') {
            state.terrainDirty = true;
        } else if (weaponStats.type === 'dirt') {
            // Dirt is added at the impact point so repeated hits stack into mounds
            this.terrainSystem.addTerrain(state, x, y, radius);

            // Add visual explosion for dirt
            state.explosions.push({
                id: nextId++,
                x,
                y,
                maxRadius: radius * 1.2,
                currentRadius: 0,
                duration: 0.5,
                elapsed: 0,
                color: weaponStats.color || '#A0522D'
            });
            this.soundManager.playExplosion();
            return;
        } else {
            // Default Explosion
            this.terrainSystem.explode(state, x, y, radius);
        }

        // Funky Bomb Logic
        if (proj && proj.weaponType === 'funky_bomb' && newQueue) {
            // Shuffle colors to ensure uniqueness
            const colors = ['red', 'green', 'blue', 'purple', 'yellow'];
            for (let i = colors.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [colors[i], colors[j]] = [colors[j], colors[i]];
            }
            
            for (let i = 0; i < 5; i++) {
                const angle = Math.random() * 180;
                const power = 100 + Math.random() * 200;
                const rad = (angle * Math.PI) / 180;
                const speed = power * 0.5;

                newQueue.push({
                    id: generateId(),
                    x: x,
                    y: y - 20,
                    vx: Math.cos(rad) * speed,
                    vy: -Math.abs(Math.sin(rad) * speed) * 1.5,
                    weaponType: 'baby_missile',
                    ownerId: proj.ownerId || -1,
                    elapsedTime: 0,
                    trail: [],
                    color: colors[i] // Unique color from shuffled list
                });
            }
        }

        // Add visual explosion 
        if (weaponId !== 'digger') {
            state.explosions.push({
                id: nextId++,
                x, y,
                maxRadius: radius * (weaponId === 'nuke' ? 1.5 : 1.2),
                currentRadius: 0,
                duration: 0.5,
                elapsed: 0,
                color: proj?.color || weaponStats.color || 'orange'
            });
            this.soundManager.playExplosion();
        }

        // Damage Tanks
        const damageAmount = weaponStats.damage;
        if (damageAmount > 0) {
            state.tanks.forEach(tank => {
                const dx = tank.x - x;
                const dy = (tank.y - TANK_CENTER_Y_OFFSET) - y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < radius + TANK_DAMAGE_RADIUS_BUFFER) {
                    const damage = Math.max(0, Math.floor(damageAmount * (1 - dist / (radius + TANK_DAMAGE_RADIUS_BUFFER))));
                    this.applyTankDamage(state, tank, damage, proj?.ownerId);
                }
            });
        }
    }

    /**
     * Applies damage to a tank, routing through any active shield first.
     * Awards credits to the attacker (damage + kill bounty), excluding self-hits.
     * Returns the health damage actually dealt after shield absorption.
     */
    public applyTankDamage(state: GameState, tank: TankState, damage: number, attackerId?: number): number {
        if (damage <= 0 || tank.health <= 0) return 0;

        // Mag Deflectors repel projectiles but do not absorb damage
        const shieldAbsorbs = tank.activeShield !== 'mag_deflector';
        if (shieldAbsorbs && tank.activeShield && tank.shieldHealth && tank.shieldHealth > 0) {
            const absorbed = Math.min(damage, tank.shieldHealth);
            tank.shieldHealth -= absorbed;
            damage -= absorbed;
            if (tank.shieldHealth <= 0) tank.activeShield = undefined;
        }

        if (damage <= 0) return 0;

        const wasAlive = tank.health > 0;
        tank.health -= damage;
        this.soundManager.playHit();
        if (tank.health <= 0) {
            tank.isDead = true;
            tankSay(state, tank, 'death', 1, 3);
        }

        // Combat earnings (Requirements 1.1: money earned between rounds)
        if (attackerId !== undefined && attackerId !== tank.id) {
            const attacker = state.tanks.find(t => t.id === attackerId);
            if (attacker) {
                attacker.credits += damage * ECONOMY.CREDITS_PER_DAMAGE;
                if (wasAlive && tank.health <= 0) {
                    attacker.credits += ECONOMY.KILL_BOUNTY;
                }
            }
        }

        return damage;
    }

    private updateTanks(state: GameState, dt: number) {
        state.tanks.forEach(tank => {
            if (tank.health <= 0) return;

            // Firing power is limited by tank strength (Requirements 1.5)
            const maxPower = getMaxPower(tank);
            if (tank.power > maxPower) tank.power = maxPower;

            const groundY = this.terrainSystem.getGroundY(Math.floor(tank.x));

            if (tank.y < groundY) {
                // Falling
                tank.isFalling = true;
                tank.vy += state.gravity * dt;

                // Parachute Logic: auto-deploy when falling fast (consumes one unit here)
                if (tank.hasLanded && !tank.isParachuteDeployed && (tank.accessories['parachute'] || 0) > 0 && tank.vy > 150) {
                    tank.isParachuteDeployed = true;
                    tank.accessories['parachute']--;  // consumed on deploy
                }

                if (tank.isParachuteDeployed) {
                    const terminal = 60;
                    if (tank.vy > terminal) {
                        tank.vy = Math.max(terminal, tank.vy - 300 * dt);
                    }
                }

                tank.y += tank.vy * dt;

                if (tank.y > groundY) {
                    tank.y = groundY;

                    if (tank.hasLanded === false) {
                        tank.hasLanded = true;
                        tank.vy = 0;
                        tank.isFalling = false;
                        return;
                    }

                    let finalDamage = 0;
                    if (tank.isParachuteDeployed) {
                        // Parachute was already consumed at deploy time; no extra deduction here
                        tank.isParachuteDeployed = false;
                    } else {
                        const rawDamage = Math.max(0, (tank.vy - 100) / 5);
                        finalDamage = Math.floor(rawDamage);

                        // Last-chance parachute catch (no parachute was auto-deployed mid-fall)
                        if (finalDamage > 0 && (tank.accessories['parachute'] || 0) > 0 && finalDamage >= (tank.parachuteThreshold || 15)) {
                            tank.accessories['parachute']--;
                            finalDamage = 0;
                        }
                    }

                    if (finalDamage > 0) {
                        tank.health -= finalDamage;
                        if (tank.health <= 0) tank.isDead = true;
                    }

                    tank.vy = 0;
                    tank.isFalling = false;
                    tank.isParachuteDeployed = false;
                }
            } else if (tank.y > groundY + 2 && tank.isFalling) {
                tank.y = groundY;
                tank.vy = 0;
                tank.isFalling = false;
            } else {
                tank.vy = 0;
                tank.isFalling = false;
            }
        });
    }

    private updateExplosions(state: GameState, dt: number) {
        let writeIdx = 0;
        for (let i = 0; i < state.explosions.length; i++) {
            const exp = state.explosions[i];
            exp.elapsed += dt;
            exp.currentRadius = exp.maxRadius * (exp.elapsed / exp.duration);
            if (exp.elapsed < exp.duration) {
                state.explosions[writeIdx++] = exp;
            }
        }
        state.explosions.length = writeIdx;

        if (state.phase === GamePhase.EXPLOSION && state.explosions.length === 0) {
            state.phase = GamePhase.TERRAIN_SETTLING;
            state.terrainDirty = true;
        }
    }

    public nextTurn(state: GameState) {
        // Win condition is checked by GameEngine after TERRAIN_SETTLING completes.
        // nextTurn is only called when alive.length > 1, so we only need to advance the player index.
        let nextIdx = (state.currentPlayerIndex + 1) % state.tanks.length;
        let guard = 0;
        while (state.tanks[nextIdx].health <= 0) {
            nextIdx = (nextIdx + 1) % state.tanks.length;
            if (++guard >= state.tanks.length) break; // safety: all dead (shouldn't happen here)
        }
        state.currentPlayerIndex = nextIdx;
        state.phase = GamePhase.AIMING;
    }

    public fireProjectile(state: GameState, power: number, angle: number, weaponId: string) {
        const tank = state.tanks[state.currentPlayerIndex];
        if (!tank) return;

        power = Math.min(power, getMaxPower(tank));

        const rad = (angle * Math.PI) / 180;
        const barrelLength = 20;
        const startX = tank.x + Math.cos(rad) * barrelLength;
        const startY = (tank.y - 12) - Math.sin(rad) * barrelLength;
        const speed = power * 0.5;

        // --- Energy Weapons (battery powered, Requirements 2.1) ---
        if (weaponId === 'laser') {
            this.fireLaser(state, tank, angle, startX, startY);
            return;
        }
        if (weaponId === 'plasma_blast') {
            this.firePlasmaBlast(state, tank);
            return;
        }

        // --- Instant Cone Logic (Riot Weapons) ---
        if (weaponId === 'riot_charge' || weaponId === 'riot_blast') {
            // Instant effect
            const spread = 45; // Degrees
            const length = weaponId === 'riot_blast' ? 150 : 100;
            this.terrainSystem.clearConicSection(state, startX, startY, angle, length, spread);

            // Visual flash
            state.explosions.push({
                id: Math.random(),
                x: startX + Math.cos(rad) * length * 0.5,
                y: startY - Math.sin(rad) * length * 0.5,
                maxRadius: 10,
                currentRadius: 0,
                duration: 0.2,
                elapsed: 0,
                color: 'white'
            });
            this.soundManager.playExplosion();

            state.phase = GamePhase.TERRAIN_SETTLING; // Skip flying
            state.lastExplosionTime = performance.now();
            return;
        }

        // --- Particle Fire Logic ---
        if (weaponId === 'dirt_charge') {
            const count = 100; // Dense cone
            const particleType = 'dirt_particle';

            for (let i = 0; i < count; i++) {
                const spread = (Math.random() - 0.5) * 30; // 30 deg spread (+/- 15)
                const newRad = ((angle + spread) * Math.PI) / 180;
                // High drag simulation: start fast but slow down fast?
                // Or just start with varied speeds and let physics handle it.
                // User wants max 100px.
                const pSpeed = speed * (0.2 + Math.random() * 0.4);

                state.projectiles.push({
                    id: generateId(),
                    x: startX,
                    y: startY,
                    vx: Math.cos(newRad) * pSpeed,
                    vy: -Math.sin(newRad) * pSpeed,
                    weaponType: particleType,
                    ownerId: tank.id,
                    elapsedTime: 0,
                    trail: []
                });
            }
            state.phase = GamePhase.PROJECTILE_FLYING;
            return;
        }

        // --- Standard Fire Logic ---
        const vx = Math.cos(rad) * speed;
        const vy = -Math.sin(rad) * speed;

        // Check for muzzle obstruction
        if (this.terrainSystem.isSolid(startX, startY)) {
            // Muzzle is buried!
            this.triggerExplosion(state, startX, startY, { weaponType: weaponId, ownerId: tank.id });

            // Determine next phase based on what triggerExplosion did
            if (state.explosions.length > 0) {
                 state.phase = GamePhase.EXPLOSION;
                 state.lastExplosionTime = performance.now();
            } else {
                 // If no visual explosion (e.g. instant terrain mod), go straight to settling
                 state.phase = GamePhase.TERRAIN_SETTLING;
                 state.terrainDirty = true;
            }
            return;
        }

        // Armed guidance is consumed one unit per shot (Requirements 2.2)
        let guidance: string | undefined;
        if (tank.activeGuidance && (tank.accessories[tank.activeGuidance] || 0) > 0) {
            guidance = tank.activeGuidance;
            tank.accessories[guidance]--;
            if (tank.accessories[guidance] <= 0) {
                tank.activeGuidance = undefined; // Supply exhausted
            }
        }

        // Armed contact triggers are consumed one per shot
        let contactTrigger: boolean | undefined;
        if (tank.activeTrigger && (tank.accessories['contact_trigger'] || 0) > 0) {
            contactTrigger = true;
            tank.accessories['contact_trigger']--;
            if (tank.accessories['contact_trigger'] <= 0) {
                tank.activeTrigger = false; // Supply exhausted
            }
        }

        const projectile: ProjectileState = {
            id: generateId(),
            x: startX,
            y: startY,
            vx: vx,
            vy: vy,
            weaponType: weaponId,
            ownerId: tank.id,
            elapsedTime: 0,
            trail: [],
            guidance,
            contactTrigger
        };
        state.projectiles.push(projectile);

        // Triple Turret Logic
        if (tank.variant === 6 && (weaponId === 'baby_missile' || weaponId === 'missile')) {
            const offsets = [-10, 10];
            offsets.forEach(off => {
                const newRad = ((angle + off) * Math.PI) / 180;
                const newVx = Math.cos(newRad) * speed;
                const newVy = -Math.sin(newRad) * speed;

                state.projectiles.push({
                    id: generateId(),
                    x: startX,
                    y: startY,
                    vx: newVx,
                    vy: newVy,
                    weaponType: weaponId,
                    ownerId: tank.id,
                    elapsedTime: 0,
                    trail: []
                });
            });
        }

        state.phase = GamePhase.PROJECTILE_FLYING;
    }

    /**
     * Mag Deflector (Requirements 2.2): kicks an enemy projectile away from
     * the protected tank. One impulse per projectile; each deflection drains
     * the deflector's charge until it breaks.
     */
    private applyMagDeflection(state: GameState, proj: ProjectileState) {
        const DEFLECT_RADIUS = 60;
        const DEFLECT_RADIUS_SQ = DEFLECT_RADIUS * DEFLECT_RADIUS;
        const KICK = 350;
        const CHARGE_PER_DEFLECT = 25;

        for (const tank of state.tanks) {
            if (tank.health <= 0 || tank.id === proj.ownerId) continue;
            if (tank.activeShield !== 'mag_deflector' || !tank.shieldHealth || tank.shieldHealth <= 0) continue;

            const dx = proj.x - tank.x;
            const dy = proj.y - (tank.y - TANK_CENTER_Y_OFFSET);
            const distSq = dx * dx + dy * dy;
            if (distSq >= DEFLECT_RADIUS_SQ || distSq < 1) continue;

            const dist = Math.sqrt(distSq);
            proj.vx += (dx / dist) * KICK;
            proj.vy += (dy / dist) * KICK;
            proj.deflected = true;

            tank.shieldHealth -= CHARGE_PER_DEFLECT;
            if (tank.shieldHealth <= 0) {
                tank.activeShield = undefined;
            }
            this.soundManager.playUI();
            return;
        }
    }

    /** Consumes up to MAX_ENERGY_BATTERIES batteries to power an energy weapon. */
    private drawBatteries(tank: TankState): number {
        const available = tank.accessories['battery'] || 0;
        const used = Math.min(available, ECONOMY.MAX_ENERGY_BATTERIES);
        if (used > 0) tank.accessories['battery'] = available - used;
        return used;
    }

    /**
     * Laser: instant high-intensity beam that cuts through terrain in a
     * straight line, damaging every tank in its path. Strength scales with
     * batteries consumed (weak without batteries).
     */
    private fireLaser(state: GameState, tank: TankState, angle: number, startX: number, startY: number) {
        const batteries = this.drawBatteries(tank);
        const damage = 25 + 45 * batteries; // 25 unpowered, 160 fully powered

        const rad = (angle * Math.PI) / 180;
        const dirX = Math.cos(rad);
        const dirY = -Math.sin(rad);
        const beamHalfWidth = 12;

        const damaged = new Set<number>();
        let x = startX;
        let y = startY;
        const step = 4;

        while (x >= 0 && x <= CONSTANTS.SCREEN_WIDTH && y >= -50 && y <= CONSTANTS.SCREEN_HEIGHT) {
            // Cut through terrain (narrow channel)
            if (this.terrainSystem.isSolid(x, y)) {
                this.terrainSystem.explode(state, x, y, 4);
            }

            for (const target of state.tanks) {
                if (target.id === tank.id || target.health <= 0 || damaged.has(target.id)) continue;
                const dx = x - target.x;
                const dy = y - (target.y - TANK_CENTER_Y_OFFSET);
                if (dx * dx + dy * dy < (TANK_COLLISION_RADIUS + beamHalfWidth) ** 2) {
                    damaged.add(target.id);
                    this.applyTankDamage(state, target, damage, tank.id);
                }
            }

            x += dirX * step;
            y += dirY * step;
        }

        tank.lastShotImpact = { x, y };

        // Beam visual: short-lived flashes along the path
        const beamLength = Math.sqrt((x - startX) ** 2 + (y - startY) ** 2);
        const segments = Math.max(2, Math.floor(beamLength / 30));
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            state.explosions.push({
                id: Math.random(),
                x: startX + (x - startX) * t,
                y: startY + (y - startY) * t,
                maxRadius: 6,
                currentRadius: 6,
                duration: 0.25,
                elapsed: 0,
                color: WEAPONS['laser'].color
            });
        }

        this.soundManager.playExplosion();
        state.phase = GamePhase.EXPLOSION;
        state.lastExplosionTime = performance.now();
    }

    /**
     * Plasma Blast: expels radioactive energy radially from the tank itself.
     * Turret direction has no effect. Radius 10-75 scaling with batteries.
     */
    private firePlasmaBlast(state: GameState, tank: TankState) {
        const batteries = this.drawBatteries(tank);
        const radius = Math.min(75, 10 + 22 * batteries);
        const damage = 50 + 50 * batteries; // 50 unpowered, 200 fully powered
        const cx = tank.x;
        const cy = tank.y - TANK_CENTER_Y_OFFSET;

        this.terrainSystem.explode(state, cx, cy, radius);

        for (const target of state.tanks) {
            if (target.id === tank.id || target.health <= 0) continue;
            const dx = target.x - cx;
            const dy = (target.y - TANK_CENTER_Y_OFFSET) - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < radius + TANK_DAMAGE_RADIUS_BUFFER) {
                const dmg = Math.max(0, Math.floor(damage * (1 - dist / (radius + TANK_DAMAGE_RADIUS_BUFFER))));
                this.applyTankDamage(state, target, dmg, tank.id);
            }
        }

        state.explosions.push({
            id: Math.random(),
            x: cx,
            y: cy,
            maxRadius: radius,
            currentRadius: 0,
            duration: 0.5,
            elapsed: 0,
            color: WEAPONS['plasma_blast'].color
        });

        this.soundManager.playExplosion();
        state.phase = GamePhase.EXPLOSION;
        state.lastExplosionTime = performance.now();
    }
}
