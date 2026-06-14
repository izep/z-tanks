import type { GameState, TankState, ProjectileState, ExplosionState } from '../core/GameState';
import { TerrainSystem } from '../systems/TerrainSystem';
import { WEAPONS } from '../core/WeaponData';

export class RenderSystem {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private terrainSystem: TerrainSystem;
    private tankSpriteCache: Record<string, { body: HTMLImageElement, turret: HTMLImageElement }> = {};

    // SVG Templates (Red is placeholder to be replaced)
    // #FF0000 -> Main Color
    // #CC0000 -> Dark Color

    // 0: Classic
    private readonly CLASSIC_BODY = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 32 32"><rect x="6" y="24" width="20" height="6" fill="#808080" /><rect x="8" y="24" width="3" height="2" fill="#505050" /><rect x="14" y="24" width="3" height="2" fill="#505050" /><rect x="20" y="24" width="3" height="2" fill="#505050" /><polygon points="2,20 30,20 28,24 4,24" fill="#MAIN" /><polygon points="4,16 28,16 30,20 2,20" fill="#DARK" /></svg>`;
    private readonly CLASSIC_TURRET = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 32 32"><rect x="10" y="12" width="12" height="6" fill="#MAIN" /><rect x="11" y="13" width="10" height="4" fill="#DARK" /><rect x="20" y="13" width="10" height="3" fill="#MAIN" /><rect x="28" y="12" width="2" height="5" fill="#800000" /></svg>`;

    // 1: Heavy
    private readonly HEAVY_BODY = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 32 32"><rect x="2" y="22" width="28" height="8" fill="#404040" /><rect x="4" y="24" width="4" height="4" fill="#202020" /><rect x="14" y="24" width="4" height="4" fill="#202020" /><rect x="24" y="24" width="4" height="4" fill="#202020" /><rect x="0" y="18" width="32" height="6" fill="#MAIN" /><rect x="4" y="14" width="24" height="4" fill="#DARK" /></svg>`;
    private readonly HEAVY_TURRET = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 32 32"><rect x="8" y="10" width="16" height="8" fill="#MAIN" /><rect x="9" y="11" width="14" height="6" fill="#DARK" /><rect x="24" y="12" width="8" height="4" fill="#MAIN" /><rect x="30" y="11" width="2" height="6" fill="#800000" /></svg>`;

    // 2: Sci-Fi
    private readonly SCIFI_BODY = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 32 32"><path d="M4 24 Q16 30 28 24 L26 20 Q16 26 6 20 Z" fill="#MAIN" /><ellipse cx="16" cy="18" rx="10" ry="4" fill="#DARK" /></svg>`;
    private readonly SCIFI_TURRET = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 32 32"><path d="M10 14 Q16 10 22 14 L28 14 L28 16 L22 16 Q16 20 10 16 Z" fill="#MAIN" /><circle cx="16" cy="15" r="3" fill="#DARK" /></svg>`;

    // 3: Hover
    private readonly HOVER_BODY = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 32 32"><ellipse cx="16" cy="22" rx="12" ry="3" fill="#00FFFF" opacity="0.5" /><path d="M6 20 L26 20 L24 14 L8 14 Z" fill="#MAIN" /><rect x="10" y="12" width="12" height="2" fill="#DARK" /></svg>`;
    private readonly HOVER_TURRET = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 32 32"><circle cx="16" cy="16" r="6" fill="#MAIN" /><rect x="22" y="15" width="8" height="2" fill="#MAIN" /><circle cx="16" cy="16" r="3" fill="#DARK" /></svg>`;

    // 4: Retro
    private readonly RETRO_BODY = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 32 32"><rect x="4" y="24" width="4" height="4" fill="#000" /><rect x="12" y="24" width="4" height="4" fill="#000" /><rect x="20" y="24" width="4" height="4" fill="#000" /><rect x="4" y="20" width="24" height="4" fill="#MAIN" /><rect x="8" y="16" width="16" height="4" fill="#MAIN" /><rect x="10" y="16" width="4" height="4" fill="#DARK" /></svg>`;
    private readonly RETRO_TURRET = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 32 32"><rect x="12" y="12" width="8" height="4" fill="#MAIN" /><rect x="20" y="14" width="8" height="2" fill="#MAIN" /><rect x="14" y="12" width="2" height="2" fill="#DARK" /></svg>`;

    // 5: Spiky
    private readonly SPIKY_BODY = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 32 32"><polygon points="6,28 10,22 14,28 18,22 22,28 26,22 30,28" fill="#505050" /><path d="M2 22 L10 16 L16 20 L22 16 L30 22 L16 26 Z" fill="#MAIN" /><polygon points="12,18 16,14 20,18" fill="#DARK" /></svg>`;
    private readonly SPIKY_TURRET = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 32 32"><polygon points="10,14 20,10 20,18" fill="#MAIN" /><rect x="20" y="13" width="10" height="2" fill="#MAIN" /><polygon points="30,12 32,14 30,16" fill="#800000" /></svg>`;

    // Parachute
    private readonly PARACHUTE_IMG = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24"><path d="M 4 12 A 8 8 0 0 1 20 12" fill="#ffffff" stroke="#000000" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" /><line x1="4" y1="12" x2="12" y2="20" stroke="#000000" stroke-width="1" stroke-linecap="round" /><line x1="20" y1="12" x2="12" y2="20" stroke="#000000" stroke-width="1" stroke-linecap="round" /><line x1="12" y1="4" x2="12" y2="20" stroke="#000000" stroke-width="1" stroke-linecap="round" /><rect x="10" y="20" width="4" height="4" fill="#000000" /></svg>`;


    // 6: Triple Turret
    private readonly TRIPLE_BODY = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 32 32"><rect x="2" y="22" width="28" height="8" fill="#202020" /><rect x="0" y="18" width="32" height="6" fill="#MAIN" /><rect x="4" y="14" width="24" height="4" fill="#DARK" /></svg>`;
    private readonly TRIPLE_TURRET = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 32 32"><rect x="14" y="10" width="4" height="8" fill="#MAIN" /><rect x="8" y="12" width="4" height="6" fill="#MAIN" /><rect x="20" y="12" width="4" height="6" fill="#MAIN" /><rect x="10" y="14" width="12" height="4" fill="#DARK" /></svg>`;

    private readonly COLOR_MAP: Record<string, { main: string, dark: string }> = {
        'red': { main: '#FF0000', dark: '#CC0000' },
        'blue': { main: '#4444FF', dark: '#000088' }, // Lighter blue for visibility
        'green': { main: '#00CC00', dark: '#006600' },
        'yellow': { main: '#FFFF00', dark: '#CCCC00' },
        'purple': { main: '#9900CC', dark: '#660099' },
        'cyan': { main: '#00FFFF', dark: '#008888' },
        'white': { main: '#FFFFFF', dark: '#BBBBBB' } // Fallback
    };

    constructor(canvas: HTMLCanvasElement, terrainSystem: TerrainSystem) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
        this.terrainSystem = terrainSystem;
    }

    public render(state: GameState) {
        // Pre-compute time values used across multiple per-frame operations
        const now = Date.now();
        const timeSec = now / 1000;
        const shieldPulse = 0.5 + 0.5 * Math.sin(timeSec * 3);

        // 1. Sky
        this.ctx.fillStyle = '#87CEEB';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 2. Base Terrain (includes all dirt that settles naturally)
        this.ctx.drawImage(this.terrainSystem.canvas, 0, 0);

        // 3. Smoke Trails (persistent)
        if (state.smokeTrails && state.smokeTrails.length > 0) {
            state.smokeTrails.forEach(trail => {
                this.drawSmokeTrail(trail, now);
            });
        }

        // 4. Tanks (always visible on top of terrain)
        state.tanks.forEach(tank => {
            if (tank.health > 0) {
                this.drawTankSprite(tank, timeSec, shieldPulse);
            }
        });

        // 5. Projectiles
        state.projectiles.forEach(proj => {
            this.drawProjectile(proj);
        });

        // 6. Explosions
        state.explosions.forEach(exp => {
            this.drawExplosion(exp);
        });
    }

    private getTankSprites(color: string, variant: number = 0) {
        const key = `${color}-${variant}`;
        if (this.tankSpriteCache[key]) {
            return this.tankSpriteCache[key];
        }

        const colors = this.COLOR_MAP[color] || this.COLOR_MAP['white'];

        // Select Template
        let bodyTmpl = this.CLASSIC_BODY;
        let turretTmpl = this.CLASSIC_TURRET;

        switch (variant) {
            case 1: bodyTmpl = this.HEAVY_BODY; turretTmpl = this.HEAVY_TURRET; break;
            case 2: bodyTmpl = this.SCIFI_BODY; turretTmpl = this.SCIFI_TURRET; break;
            case 3: bodyTmpl = this.HOVER_BODY; turretTmpl = this.HOVER_TURRET; break;
            case 4: bodyTmpl = this.RETRO_BODY; turretTmpl = this.RETRO_TURRET; break;
            case 5: bodyTmpl = this.SPIKY_BODY; turretTmpl = this.SPIKY_TURRET; break;
            case 6: bodyTmpl = this.TRIPLE_BODY; turretTmpl = this.TRIPLE_TURRET; break;
            default: break; // Classic default
        }

        // Generate Body
        const bodySvg = bodyTmpl.replace(/#MAIN/g, colors.main).replace(/#DARK/g, colors.dark);
        const bodyBlob = new Blob([bodySvg], { type: 'image/svg+xml' });
        const bodyUrl = URL.createObjectURL(bodyBlob);
        const bodyImg = new Image();
        bodyImg.onload = () => URL.revokeObjectURL(bodyUrl);
        bodyImg.src = bodyUrl;

        // Generate Turret
        const turretSvg = turretTmpl.replace(/#MAIN/g, colors.main).replace(/#DARK/g, colors.dark);
        const turretBlob = new Blob([turretSvg], { type: 'image/svg+xml' });
        const turretUrl = URL.createObjectURL(turretBlob);
        const turretImg = new Image();
        turretImg.onload = () => URL.revokeObjectURL(turretUrl);
        turretImg.src = turretUrl;

        this.tankSpriteCache[key] = { body: bodyImg, turret: turretImg };
        return this.tankSpriteCache[key];
    }

    private drawTankSprite(tank: TankState, timeSec: number, shieldPulse: number) {
        const sprites = this.getTankSprites(tank.color, tank.variant);

        // Ideally wait for load, but data URIs / Blob URLs might be fast enough
        // Or we just draw and if it flickers once it's fine.
        // For robustness, check complete?
        if (!sprites.body.complete || !sprites.turret.complete) return;

        this.ctx.save();

        // Body (32x32 in SVG viewbox, we want approx 30x30 world)
        // SVG viewbox is 0 0 32 32.
        const size = 32;

        // Draw centered at tank.x, tank.y (bottom aligned)
        // tank.y is bottom of text bounds usually, terrain y.
        // Tank body should sit ON terrain.
        // drawImage(img, dx, dy, dw, dh)
        const drawX = tank.x - size / 2;
        const drawY = tank.y - size + 5; // + offset to sink slightly?

        this.ctx.drawImage(sprites.body, drawX, drawY, size, size);

        // Turret
        this.ctx.save();
        this.ctx.translate(tank.x, tank.y - 12); // Pivot
        this.ctx.rotate(-tank.angle * Math.PI / 180);

        // Turret Center Pivot?
        this.ctx.drawImage(sprites.turret, -16, -16, size, size); // Centered on pivot

        this.ctx.restore();

        // Health Bar
        const healthY = -35;
        this.ctx.translate(tank.x, tank.y);
        this.ctx.fillStyle = 'red';
        this.ctx.fillRect(-15, healthY, 30, 4);
        this.ctx.fillStyle = '#0f0';
        this.ctx.fillRect(-15, healthY, 30 * (tank.health / 100), 4);

        // Active Shield - Enhanced visibility
        if (tank.activeShield && tank.shieldHealth && tank.shieldHealth > 0) {
            const shieldAlpha = Math.min(1.0, tank.shieldHealth / 200);

            this.ctx.save();
            this.ctx.globalAlpha = 0.3 + 0.2 * shieldPulse * shieldAlpha;

            // Outer shield glow
            this.ctx.strokeStyle = '#00FFFF';
            this.ctx.lineWidth = 3;
            this.ctx.shadowColor = '#00FFFF';
            this.ctx.shadowBlur = 15;
            this.ctx.beginPath();
            this.ctx.arc(0, -10, 28, 0, Math.PI * 2);
            this.ctx.stroke();

            // Inner shield layer
            this.ctx.strokeStyle = '#FFFFFF';
            this.ctx.lineWidth = 2;
            this.ctx.shadowBlur = 8;
            this.ctx.beginPath();
            this.ctx.arc(0, -10, 25, 0, Math.PI * 2);
            this.ctx.stroke();

            // Shield health indicator (hexagons for sci-fi look)
            this.ctx.globalAlpha = 0.5 * shieldAlpha;
            this.ctx.fillStyle = '#00FFFF';
            for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI / 3) + timeSec;
                const x = 22 * Math.cos(angle);
                const y = -10 + 22 * Math.sin(angle);
                this.ctx.beginPath();
                this.ctx.arc(x, y, 3, 0, Math.PI * 2);
                this.ctx.fill();
            }

            this.ctx.restore();
        }

        this.ctx.restore();

        // Talking Bubble
        if (tank.sayTimer && tank.sayTimer > 0 && tank.lastWords) {
            this.ctx.save();
            this.ctx.font = '12px "Press Start 2P", sans-serif'; // Assuming font availability or fallback
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'bottom';
            const text = tank.lastWords;
            const tx = tank.x;
            const ty = tank.y - 45;

            // Bubble
            const padding = 5;
            const metrics = this.ctx.measureText(text);
            const w = metrics.width + padding * 2;
            const h = 20;

            this.ctx.fillStyle = 'white';
            this.ctx.beginPath();
            this.ctx.roundRect(tx - w / 2, ty - h, w, h, 5);
            this.ctx.fill();

            // Tail
            this.ctx.beginPath();
            this.ctx.moveTo(tx, ty);
            this.ctx.lineTo(tx - 5, ty);
            this.ctx.lineTo(tx, ty + 5);
            this.ctx.fill();

            this.ctx.fillStyle = 'black';
            this.ctx.fillText(text, tx, ty - 5);
            this.ctx.restore();
        }

        // Parachute
        if (tank.isParachuteDeployed) {
            const pSize = 40;
            const pX = tank.x - pSize / 2;
            const pY = tank.y - size - pSize + 10;

            // Lazy load parachute image if not cached? 
            // Ideally cache it. For now, create blob on fly or cache globally?
            // Let's rely on a getParachuteImage helper to avoid creating Blooms every frame.
            const pImg = this.getParachuteImage();
            if (pImg.complete) {
                this.ctx.drawImage(pImg, pX, pY, pSize, pSize);
            }
        }
    }

    private _parachuteImage: HTMLImageElement | null = null;
    private getParachuteImage() {
        if (!this._parachuteImage) {
            const blob = new Blob([this.PARACHUTE_IMG], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            this._parachuteImage = new Image();
            this._parachuteImage.onload = () => URL.revokeObjectURL(url);
            this._parachuteImage.src = url;
        }
        return this._parachuteImage;
    }

    private drawProjectile(proj: ProjectileState) {
        this.ctx.save();
        const weaponId = proj.weaponType || 'missile';
        const isLiquidDirt = weaponId === 'liquid_dirt_particle';
        const isNapalm = weaponId === 'napalm_particle';

        // Trail
        if (proj.trail.length > 1 && !isLiquidDirt && !isNapalm) {
            this.ctx.beginPath();
            this.ctx.moveTo(proj.trail[0].x, proj.trail[0].y);
            for (let i = 1; i < proj.trail.length; i++) {
                const prev = proj.trail[i - 1];
                const curr = proj.trail[i];
                if (Math.abs(curr.x - prev.x) > 100) {
                    this.ctx.moveTo(curr.x, curr.y);
                } else {
                    this.ctx.lineTo(curr.x, curr.y);
                }
            }
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }

        // Projectile
        this.ctx.translate(proj.x, proj.y);
        const angle = Math.atan2(proj.vy, proj.vx);
        this.ctx.rotate(angle);

        let color = proj.color || WEAPONS[weaponId]?.color || 'white';
        if (isLiquidDirt) {
            color = WEAPONS['liquid_dirt']?.color || '#E6D2B5';
        } else if (isNapalm) {
            color = '#FF0000'; // Red liquid base
        }

        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        // Smaller particle for liquid/napalm
        const radius = (isLiquidDirt || isNapalm) ? 2 : 3;
        this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Fire Effect for Napalm
        if (isNapalm) {
            this.ctx.globalAlpha = 0.8;
            this.ctx.fillStyle = Math.random() > 0.5 ? '#FFA500' : '#FFFF00'; // Orange or Yellow
            
            // Draw a flame shape (triangle-ish)
            // Since we rotated the context to align with velocity, "up" relative to screen depends on rotation.
            // But we want fire to burn UP (against gravity) or maybe align with movement?
            // Actually, usually fire burns UP.
            // But context is rotated. We should unrotate or just draw relative to projectile.
            // If we draw relative to projectile in rotated context, flame points "forward".
            // Let's unrotate temporarily or just draw loosely.
            // Actually, easier to just draw simple flicker circles.
            
            const flameSize = 2 + Math.random() * 3;
            const flameOffset = 3 + Math.random() * 2;
            
            // We want flame to be "up" relative to the GROUND or SCREEN, not velocity.
            // But we are rotated.
            // Undo rotation for the flame?
            this.ctx.rotate(-angle); // Undo rotation
            
            this.ctx.beginPath();
            this.ctx.arc(0, -flameOffset, flameSize, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    private drawExplosion(exp: ExplosionState) {
        this.ctx.save();
        this.ctx.globalAlpha = 1 - (exp.elapsed / exp.duration);
        this.ctx.fillStyle = exp.color;
        this.ctx.beginPath();
        this.ctx.arc(exp.x, exp.y, exp.currentRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Core
        this.ctx.fillStyle = 'white';
        this.ctx.beginPath();
        this.ctx.arc(exp.x, exp.y, exp.currentRadius * 0.7, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.restore();
    }

    private drawSmokeTrail(trail: import('../core/GameState').SmokeTrailState, now: number) {
        if (trail.points.length < 2) return;

        const age = now - trail.createdAt;
        const fadeProgress = age / trail.duration;
        const opacity = Math.max(0, 1 - fadeProgress);
        if (opacity <= 0) return;

        const lw = trail.lineWidth ?? 3;

        this.ctx.save();
        this.ctx.globalAlpha = opacity;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        // Glow halo for thick beams (laser, plasma)
        if (lw > 4) {
            this.ctx.strokeStyle = 'white';
            this.ctx.lineWidth = lw * 0.4;
            this.ctx.globalAlpha = opacity * 0.6;
            this.ctx.beginPath();
            this.ctx.moveTo(trail.points[0].x, trail.points[0].y);
            for (let i = 1; i < trail.points.length; i++) {
                this.ctx.lineTo(trail.points[i].x, trail.points[i].y);
            }
            this.ctx.stroke();
            this.ctx.globalAlpha = opacity;
        }

        this.ctx.strokeStyle = trail.color;
        this.ctx.lineWidth = lw;
        this.ctx.beginPath();
        this.ctx.moveTo(trail.points[0].x, trail.points[0].y);
        for (let i = 1; i < trail.points.length; i++) {
            this.ctx.lineTo(trail.points[i].x, trail.points[i].y);
        }
        this.ctx.stroke();

        this.ctx.restore();
    }
}