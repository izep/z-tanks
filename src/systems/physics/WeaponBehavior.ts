import { type GameState, type ProjectileState, CONSTANTS } from '../../core/GameState';
import { TerrainSystem } from '../TerrainSystem';
import { SoundManager } from '../../core/SoundManager';
import { WEAPONS } from '../../core/WeaponData';
import { generateId } from '../PhysicsSystem';

export interface PhysicsContext {
    terrainSystem: TerrainSystem;
    soundManager: SoundManager;
    triggerExplosion: (state: GameState, x: number, y: number, proj?: any, newQueue?: any[]) => void;
    addProjectile: (proj: any) => void; // To add new projectiles (mirv, fragments)
    applyTankDamage: (state: GameState, tank: any, damage: number, attackerId?: number) => number;
}

export interface WeaponBehavior {
    update(projectile: ProjectileState, state: GameState, dt: number, context: PhysicsContext): boolean; // returns true if removed
}

export class StandardFlightBehavior implements WeaponBehavior {
    update(projectile: ProjectileState, state: GameState, dt: number, context: PhysicsContext): boolean {
        // Normal flying
        projectile.vx += state.wind * dt * 6;
        projectile.vy += state.gravity * dt * 10;

        // Guidance systems (Requirements 2.2): steer toward the nearest enemy.
        // Heat Guidance only corrects during descent; Lazy Boy homes all flight.
        if (projectile.guidance) {
            const isLazyBoy = projectile.guidance === 'lazy_boy';
            if (isLazyBoy || projectile.vy > 0) {
                let target: { x: number, y: number } | null = null;
                let bestDistSq = Infinity;
                for (const tank of state.tanks) {
                    if (tank.id === projectile.ownerId || tank.health <= 0) continue;
                    const dx = tank.x - projectile.x;
                    const dy = (tank.y - 10) - projectile.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < bestDistSq) {
                        bestDistSq = distSq;
                        target = { x: tank.x, y: tank.y - 10 };
                    }
                }
                if (target && bestDistSq > 1) {
                    const dist = Math.sqrt(bestDistSq);
                    const strength = isLazyBoy ? 400 : 150;
                    projectile.vx += ((target.x - projectile.x) / dist) * strength * dt;
                    projectile.vy += ((target.y - projectile.y) / dist) * strength * dt;
                }
            }
        }

        projectile.x += projectile.vx * dt;
        projectile.y += projectile.vy * dt;

        // MIRV and Death's Head Logic
        if (!projectile.splitDone && projectile.vy > 0) {
            // Check if about to hit terrain (don't split if close to ground)
            const groundY = context.terrainSystem.getGroundY(Math.floor(projectile.x));
            const clearance = groundY - projectile.y;
            
            // Only split if we have enough clearance (not about to hit ground)
            if (clearance > 20) {
                if (projectile.weaponType === 'mirv') {
                    projectile.splitDone = true;
                    // Deploy 5 missile warheads with even spread
                    const offsets = [-100, -50, 0, 50, 100];
                    offsets.forEach(off => {
                        context.addProjectile({
                            id: generateId(),
                            x: projectile.x,
                            y: projectile.y,
                            vx: projectile.vx + off,
                            vy: projectile.vy,
                            weaponType: 'missile', // Each warhead is a missile
                            ownerId: projectile.ownerId,
                            elapsedTime: 0,
                            trail: [],
                            splitDone: true
                        });
                    });
                    return true; // Remove parent MIRV
                } else if (projectile.weaponType === 'death_head') {
                    projectile.splitDone = true;
                    // Death's Head carries nine large-scale warheads (Requirements 2.1)
                    const numFragments = 9;
                    for (let i = 0; i < numFragments; i++) {
                        const spread = -120 + (i * 30);
                        context.addProjectile({
                            id: generateId(),
                            x: projectile.x,
                            y: projectile.y,
                            vx: projectile.vx + spread,
                            vy: projectile.vy,
                            weaponType: 'baby_nuke',
                            ownerId: projectile.ownerId,
                            elapsedTime: 0,
                            trail: [],
                            splitDone: true
                        });
                    }
                    return true; // Remove parent
                }
            }
        }

        return false;
    }
}

export class LeapfrogBehavior implements WeaponBehavior {
    update(projectile: ProjectileState, state: GameState, dt: number, context: PhysicsContext): boolean {
        // Initialize stage if not set
        if (projectile.leapfrogStage === undefined) {
            projectile.leapfrogStage = 0;
        }

        // 1. Physics (Standard Flight)
        projectile.vx += state.wind * dt * 6;
        projectile.vy += state.gravity * dt * 10;
        projectile.x += projectile.vx * dt;
        projectile.y += projectile.vy * dt;

        // 2. Collision Detection
        let hit = false;

        // Ground Check
        const groundY = context.terrainSystem.getGroundY(Math.floor(projectile.x));
        if (projectile.y >= groundY) {
            hit = true;
            projectile.y = groundY;
        }

        // Bottom of screen check
        if (!hit && projectile.y >= CONSTANTS.SCREEN_HEIGHT) {
            hit = true;
        }

        // Tank Check
        if (!hit) {
            for (const tank of state.tanks) {
                if (tank.health <= 0) continue;
                const dx = projectile.x - tank.x;
                const dy = projectile.y - (tank.y - 10);
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 15) {
                    hit = true;
                    break;
                }
            }
        }

        // 3. Handle Impact - Sequential Warhead Launch
        if (hit) {
            // Explode current warhead
            context.triggerExplosion(state, projectile.x, projectile.y, projectile);

            // Increment stage
            projectile.leapfrogStage = (projectile.leapfrogStage || 0) + 1;

            // Launch next warhead if we haven't launched all 3
            if (projectile.leapfrogStage < 3) {
                // Launch next warhead from explosion point
                const nextWarhead = {
                    id: generateId(),
                    x: projectile.x,
                    y: projectile.y - 10, // Launch slightly above explosion
                    vx: projectile.vx * 0.8, // Slightly dampened velocity
                    vy: -100, // Launch upward
                    weaponType: 'leapfrog',
                    ownerId: projectile.ownerId,
                    elapsedTime: 0,
                    trail: [],
                    leapfrogStage: projectile.leapfrogStage
                };
                context.addProjectile(nextWarhead);
            }

            // Remove current warhead
            return true;
        }

        return false;
    }
}

export class LiquidBehavior implements WeaponBehavior {
    update(proj: ProjectileState, state: GameState, dt: number, context: PhysicsContext): boolean {
        // 1. Gravity (Always pull down)
        proj.vy += state.gravity * dt * 10;

        // 2. Predict next position
        let nextX = proj.x + proj.vx * dt;
        let nextY = proj.y + proj.vy * dt;

        // 3. Ground Interaction
        const groundY = context.terrainSystem.getGroundY(Math.floor(nextX));

        if (nextY >= groundY) {
            // Snap to surface
            nextY = groundY;
            proj.vy = 0; // Kill vertical momentum
            proj.y = nextY;
            proj.x = nextX;

            // 4. Flow Logic (The "Ooze")
            // Sample slope
            const lookAhead = 4;
            const yLeft = context.terrainSystem.getGroundY(Math.floor(proj.x - lookAhead));
            const yRight = context.terrainSystem.getGroundY(Math.floor(proj.x + lookAhead));
            const slope = yRight - yLeft; // Positive if Right is deeper (downhill to right)

            // Acceleration downhill
            const flowSpeed = 50;
            proj.vx += slope * flowSpeed * dt;

            // Friction / Viscosity
            // If moving UPHILL (vx > 0 and slope < 0 OR vx < 0 and slope > 0), apply harsh friction
            const movingUphill = (proj.vx > 0 && slope < -2) || (proj.vx < 0 && slope > 2);
            
            if (movingUphill) {
                proj.vx *= 0.8; // Reduced drag uphill to allow sloshing
            } else {
                proj.vx *= 0.95; // Low friction downhill (slippery)
            }

            // Local Peak Avoidance (Anti-Column)
            // If moving slowly, check if we are on a peak
            if (Math.abs(proj.vx) < 30) {
                const range = 5;
                const hLeft = context.terrainSystem.getGroundY(Math.floor(proj.x - range));
                const hRight = context.terrainSystem.getGroundY(Math.floor(proj.x + range));
                const myH = groundY;
                
                // If neighbors are deeper (larger Y) than me, I am on a peak/bump.
                // Push me towards the deeper side.
                if (hLeft > myH + 2) {
                    proj.vx -= 200 * dt; // Push Left
                } else if (hRight > myH + 2) {
                    proj.vx += 200 * dt; // Push Right
                }
            }

            // 5. Settling (Freezing)
            // Strict settling: must be very slow and very flat
            if (Math.abs(proj.vx) < 5 && Math.abs(slope) < 2) {
                // Turn into dirt
                context.terrainSystem.addTerrain(state, proj.x, proj.y, 2, WEAPONS['liquid_dirt']?.color || '#E6D2B5');
                return true; // Remove particle
            }

            // 6. Spread / Diffusion (prevent stacking in one pixel)
            // Jitter to avoid stacking
            if (Math.abs(proj.vx) < 10) {
                 proj.vx += (Math.random() - 0.5) * 50;
            }

        } else {
            // In air
            proj.x = nextX;
            proj.y = nextY;
        }

        // 7. Life & Out of Bounds
        proj.elapsedTime += dt;
        if (proj.elapsedTime > 2.5) { // Max life 2.5s (Reduced from 5.0)
             // Force settle
             context.terrainSystem.addTerrain(state, proj.x, proj.y, 2, WEAPONS['liquid_dirt']?.color || '#E6D2B5');
             return true;
        }
        
        // Horizontal bounds
        if (proj.x < 0 || proj.x > CONSTANTS.SCREEN_WIDTH) {
            return true;
        }

        return false;
    }
}

export class NapalmBehavior implements WeaponBehavior {
    update(proj: ProjectileState, state: GameState, dt: number, context: PhysicsContext): boolean {
        // 1. Gravity
        proj.vy += state.gravity * dt * 10;

        // 2. Predict next position
        let nextX = proj.x + proj.vx * dt;
        let nextY = proj.y + proj.vy * dt;

        // 3. Ground Interaction
        const groundY = context.terrainSystem.getGroundY(Math.floor(nextX));

        if (nextY >= groundY) {
            // Snap to surface
            nextY = groundY;
            proj.vy = 0;
            proj.y = nextY;
            proj.x = nextX;

            // 4. Flow Logic (The "Ooze")
            const lookAhead = 4;
            const yLeft = context.terrainSystem.getGroundY(Math.floor(proj.x - lookAhead));
            const yRight = context.terrainSystem.getGroundY(Math.floor(proj.x + lookAhead));
            const slope = yRight - yLeft;

            // Acceleration downhill
            const flowSpeed = 50;
            proj.vx += slope * flowSpeed * dt;

            // Friction
            const movingUphill = (proj.vx > 0 && slope < -2) || (proj.vx < 0 && slope > 2);
            if (movingUphill) {
                proj.vx *= 0.8; 
            } else {
                proj.vx *= 0.95; 
            }

            // Local Peak Avoidance
            if (Math.abs(proj.vx) < 30) {
                const range = 5;
                const hLeft = context.terrainSystem.getGroundY(Math.floor(proj.x - range));
                const hRight = context.terrainSystem.getGroundY(Math.floor(proj.x + range));
                const myH = groundY;
                if (hLeft > myH + 2) proj.vx -= 200 * dt;
                else if (hRight > myH + 2) proj.vx += 200 * dt;
            }

            // Burning Effect (Discolor ground while flowing/sitting)
            if (Math.random() < 0.3) { // More frequent burning
                context.terrainSystem.burnTerrain(state, proj.x, proj.y, 8); 
                if (Math.random() < 0.01) {
                    context.soundManager.playSizzle();
                }
            }

            // Minimal actual terrain removal (Very small pitting)
            if (Math.random() < 0.02) {
                context.terrainSystem.explode(state, proj.x, proj.y, 2);
            }

            // Settling (Burn out)
            if (Math.abs(proj.vx) < 5 && Math.abs(slope) < 2) {
                return true; // Just disappear (burned out)
            }

            // Jitter
            if (Math.abs(proj.vx) < 10) {
                 proj.vx += (Math.random() - 0.5) * 50;
            }

        } else {
            // In air
            proj.x = nextX;
            proj.y = nextY;
        }

        // Tank Collision (Burn tanks)
        for (const tank of state.tanks) {
            if (tank.health <= 0) continue;
            const dx = proj.x - tank.x;
            const dy = proj.y - (tank.y - 10);
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 15) {
                context.applyTankDamage(state, tank, 0.5, proj.ownerId); // Burn damage
                // Don't stop, flow through/over tank
            }
        }

        // 7. Life & Out of Bounds
        proj.elapsedTime += dt;
        if (proj.elapsedTime > 2.5) {
             return true; // Burned out
        }
        
        if (proj.x < 0 || proj.x > CONSTANTS.SCREEN_WIDTH) {
            return true;
        }

        return false;
    }
}

export class ParticleBehavior implements WeaponBehavior {
    update(proj: ProjectileState, state: GameState, dt: number, context: PhysicsContext): boolean {
        const weaponId = proj.weaponType;

        // Gravity
        proj.vy += state.gravity * dt * 5;
        
        // Drag for dirt charge to limit range
        if (weaponId === 'dirt_particle') {
            proj.vx *= 0.9; // Strong air resistance
            proj.vy *= 0.9;
        }

        // Movement
        const nextX = proj.x + proj.vx * dt;
        const nextY = proj.y + proj.vy * dt;

        // Check if we hit solid ground
        // We check if the destination pixel is solid
        if (context.terrainSystem.isSolid(nextX, nextY)) {
             // Hit ground!
             if (weaponId === 'dirt_particle') {
                 context.terrainSystem.addTerrain(state, proj.x, proj.y, 4, WEAPONS['dirt_charge']?.color);
                 return true;
             }
        }
        
        proj.x = nextX;
        proj.y = nextY;

        // Ground Check
        const groundY = context.terrainSystem.getGroundY(Math.floor(proj.x));

        // Tank Collision Logic
        for (const tank of state.tanks) {
            if (tank.health <= 0) continue;
            const dx = proj.x - tank.x;
            const dy = proj.y - (tank.y - 10);
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 15) {
                if (weaponId === 'dirt_particle') {
                    const color = WEAPONS['dirt_charge']?.color;
                    context.terrainSystem.addTerrain(state, tank.x, tank.y, 4, color);
                    return true;
                }
            }
        }

        if (proj.y >= groundY) {
            proj.y = groundY;

            // Sliding physics
            const groundYNext = context.terrainSystem.getGroundY(Math.floor(proj.x + (proj.vx > 0 ? 5 : -5)));
            const slope = groundYNext - groundY;

            if (Math.abs(slope) > 2) {
                proj.vx += slope * 5 * dt; // Slide down
            } else {
                proj.vx *= 0.9; // Friction
            }
            
            // Stop condition
            if (Math.abs(proj.vx) < 5) {
                if (weaponId === 'dirt_particle') {
                    const color = WEAPONS['dirt_charge']?.color;
                    context.terrainSystem.addTerrain(state, proj.x, proj.y, 4, color);
                    return true;
                }
            }
        }

        proj.elapsedTime += dt;
        // Short life for dirt charge to ensure it settles as a cone
        const maxLife = weaponId === 'dirt_particle' ? 0.5 : 2.0;
        
        if (proj.elapsedTime > maxLife) {
            if (weaponId === 'dirt_particle') {
                 context.terrainSystem.addTerrain(state, proj.x, proj.y, 4, WEAPONS['dirt_charge']?.color);
            }
            return true;
        }
        return false;
    }
}

export class RollingBehavior implements WeaponBehavior {
    update(proj: ProjectileState, state: GameState, dt: number, context: PhysicsContext): boolean {
        // Get slope
        const groundY = context.terrainSystem.getGroundY(Math.floor(proj.x));
        const groundYNext = context.terrainSystem.getGroundY(Math.floor(proj.x + (proj.vx > 0 ? 5 : -5)));

        // Slope angle
        const dy = groundYNext - groundY;
        const dx = (proj.vx > 0 ? 5 : -5);
        const angle = Math.atan2(dy, dx); // Radians

        // Gravity component
        const gravity = 100;
        const ax = gravity * Math.sin(angle);

        // Friction
        const friction = 30;
        if (proj.vx > 0) proj.vx -= friction * dt;
        else if (proj.vx < 0) proj.vx += friction * dt;

        // Apply Slope Gravity
        proj.vx += ax * dt * 8;

        proj.x += proj.vx * dt;

        // Snap to ground
        const newGroundY = context.terrainSystem.getGroundY(Math.floor(proj.x));

        // Wall Check / steep slope check
        if (Math.abs(dy) > 15) {
            // Reflect velocity slightly
            proj.vx = -proj.vx * 0.5;
            // If still stuck, explode
            if (Math.abs(proj.vx) < 5) {
                    context.triggerExplosion(state, proj.x, proj.y, proj);
                    return true;
            }
        } else {
            proj.y = newGroundY;
        }

        // Stop if too slow
        if (Math.abs(proj.vx) < 5) {
            context.triggerExplosion(state, proj.x, proj.y, proj);
            return true;
        }

        // Check Tank Collision
        for (const tank of state.tanks) {
            if (tank.health <= 0) continue;
            const tdx = proj.x - tank.x;
            const tdy = proj.y - (tank.y - 10);
            const dist = Math.sqrt(tdx * tdx + tdy * tdy);
            if (dist < 20) {
                // If tank has active shield, bounce off
                if (tank.activeShield && tank.shieldHealth && tank.shieldHealth > 0) {
                    // Bounce: reverse horizontal velocity
                    proj.vx = -proj.vx * 0.8;
                    // Push away from tank
                    const pushDist = 25;
                    proj.x = tank.x + (tdx / dist) * pushDist;
                    return false; // Continue rolling
                }
                // No shield: explode on contact
                context.triggerExplosion(state, proj.x, proj.y, proj);
                return true;
            }
        }

        return false;
    }
}

export class DiggingBehavior implements WeaponBehavior {
    update(proj: ProjectileState, state: GameState, dt: number, context: PhysicsContext): boolean {
        proj.vx += state.wind * dt * 0.1;
        proj.vy += state.gravity * dt * 10;

        // Add weaving noise
        const time = performance.now() / 100;
        proj.vx += Math.sin(time) * 50 * dt;

        proj.x += proj.vx * dt;
        proj.y += proj.vy * dt;

        // Digging effect
        const groundY = context.terrainSystem.getGroundY(Math.floor(proj.x));
        if (proj.y > groundY) {
            context.terrainSystem.explode(state, proj.x, proj.y, 10);
        }
        
        // Digger Collision Logic with Tanks (Explicit check needed as they ignore terrain)
        for (const tank of state.tanks) {
            const dx = proj.x - tank.x;
            const dy = proj.y - (tank.y - 10);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 20) {
                // Diggers fizzle on tank hit
                return true;
            }
        }

        return false;
    }
}

export class SandhogBehavior implements WeaponBehavior {
    update(proj: ProjectileState, state: GameState, dt: number, context: PhysicsContext): boolean {
        proj.vx += state.wind * dt * 0.1;
        proj.vy += state.gravity * dt * 10;

        // Add weaving noise
        const time = performance.now() / 100;
        proj.vx += Math.cos(time) * 50 * dt;

        proj.x += proj.vx * dt;
        proj.y += proj.vy * dt;

        // Check for impact (ground or tank)
        const groundY = context.terrainSystem.getGroundY(Math.floor(proj.x));
        let shouldDeploy = false;

        // Ground impact
        if (proj.y >= groundY) {
            shouldDeploy = true;
        }

        // Tank impact
        for (const tank of state.tanks) {
            if (tank.health <= 0) continue;
            const dx = proj.x - tank.x;
            const dy = proj.y - (tank.y - 10);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 20) {
                shouldDeploy = true;
                break;
            }
        }

        // Deploy warheads on impact
        if (shouldDeploy) {
            const weaponId = proj.weaponType;
            let numWarheads = 3; // Baby Sandhog
            let tunnelLength = 30; // Baby Sandhog
            let blastRadius = 10; // Baby Sandhog

            if (weaponId === 'sandhog') {
                numWarheads = 5;
                tunnelLength = 50;
                blastRadius = 15;
            } else if (weaponId === 'heavy_sandhog') {
                numWarheads = 7;
                tunnelLength = 80;
                blastRadius = 20;
            }

            // Deploy warheads
            const newQueue: any[] = [];
            for (let i = 0; i < numWarheads; i++) {
                // Spread warheads in different directions
                const angle = -90 + (i / (numWarheads - 1)) * 180; // -90 to +90 degrees
                const rad = (angle * Math.PI) / 180;
                const direction = Math.cos(rad) > 0 ? 1 : -1;

                newQueue.push({
                    id: generateId(),
                    x: proj.x,
                    y: proj.y,
                    vx: 0,
                    vy: 0,
                    weaponType: 'sandhog_warhead',
                    ownerId: proj.ownerId,
                    elapsedTime: 0,
                    trail: [],
                    direction: direction,
                    tunnelLength: tunnelLength,
                    distanceRemaining: tunnelLength,
                    blastRadius: blastRadius,
                    damage: WEAPONS[weaponId]?.damage || 50
                });
            }

            // Add warheads to projectiles
            if (newQueue.length > 0) {
                newQueue.forEach(warhead => context.addProjectile(warhead));
            }

            return true; // Remove parent projectile
        }

        return false;
    }
}

export class SandhogWarheadBehavior implements WeaponBehavior {
    update(proj: ProjectileState, state: GameState, dt: number, context: PhysicsContext): boolean {
        // Horizontal tunneling
        const distanceRemaining = proj.distanceRemaining ?? 0;
        const direction = proj.direction ?? 1;
        const blastRadius = proj.blastRadius ?? 10;
        const damage = proj.damage ?? 50;

        if (distanceRemaining > 0) {
            // Remove terrain as we tunnel
            context.terrainSystem.explode(state, proj.x, proj.y, 3);
            
            // Move horizontally
            const speed = 60; // pixels per second
            proj.x += direction * speed * dt;
            proj.distanceRemaining = distanceRemaining - speed * dt;
        } else {
            // Explode at end of tunnel
            context.terrainSystem.explode(state, proj.x, proj.y, blastRadius);
            
            // Apply damage to nearby tanks
            for (const tank of state.tanks) {
                if (tank.health <= 0) continue;
                const dx = proj.x - tank.x;
                const dy = proj.y - (tank.y - 10);
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < blastRadius + 10) {
                    const dmg = damage * (1 - dist / (blastRadius + 10));
                    context.applyTankDamage(state, tank, dmg, proj.ownerId);
                }
            }

            // Visual explosion
            state.explosions.push({
                id: Math.random(),
                x: proj.x,
                y: proj.y,
                maxRadius: blastRadius,
                currentRadius: 0,
                duration: 0.3,
                elapsed: 0,
                color: '#DAA520'
            });

            context.soundManager.playExplosion();
            return true; // Remove warhead
        }

        // Check if out of bounds
        if (proj.x < 0 || proj.x > CONSTANTS.SCREEN_WIDTH) {
            return true;
        }

        return false;
    }
}