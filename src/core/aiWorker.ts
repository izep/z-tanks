/**
 * AI Trajectory Solver — runs in a Web Worker.
 *
 * Receives a SolveRequest, performs the heavy binary-search / simulation loop
 * entirely off the main thread, and posts back a SolveResponse.
 */

// ---- shared types (duplicated here so the worker is fully self-contained) ----

export interface TerrainSnapshot {
    terrainMask: Uint8Array;
    heightMap: Uint16Array;
    width: number;
    height: number;
}

export interface SolveTarget {
    x: number;
    y: number;
    id: number;
}

export interface SolveRequest {
    id: number; // correlation id so the caller can match the response
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    gravity: number;
    wind: number;
    borderMode: string | undefined;
    minAngle: number;
    maxAngle: number;
    angleStep: number;
    powerSteps: number;
    preferLowArc: boolean;
    ignoreWind: boolean;
    safeDistance: number;
    tankX: number; // firing tank position (safety check)
    tankY: number;
    terrain: TerrainSnapshot;
    screenWidth: number;
    screenHeight: number;
}

export interface SolveResponse {
    id: number;
    angle: number | null;
    power: number | null;
}

// ---- pure simulation --------------------------------------------------------

function isSolid(mask: Uint8Array, width: number, height: number, x: number, y: number): boolean {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || ix >= width || iy < 0 || iy >= height) return false;
    return mask[iy * width + ix] === 1;
}

function simulateShot(
    req: SolveRequest,
    angleDeg: number,
    power: number,
): { hitTarget: boolean; overshot: boolean; minDist: number; x: number; y: number } {
    const { startX, startY, targetX, targetY, gravity, wind, borderMode, terrain, screenWidth, screenHeight } = req;
    const { terrainMask, width, height } = terrain;

    const rad = angleDeg * (Math.PI / 180);
    const speed = power * 0.5;
    let vx = Math.cos(rad) * speed;
    let vy = -Math.sin(rad) * speed;
    let x = startX;
    let y = startY;

    const dt = 1 / 60;
    const maxTime = 10;
    const targetRadius = 25;
    const direction = targetX > startX ? 1 : -1;
    let minDist = Infinity;
    const windForce = req.ignoreWind ? 0 : wind;

    for (let t = 0; t < maxTime; t += dt) {
        vx += windForce * dt * 6;
        vy += gravity * dt * 10;
        x += vx * dt;
        y += vy * dt;

        if (borderMode === 'wrap') {
            if (x < 0) x += screenWidth;
            else if (x > screenWidth) x -= screenWidth;
        } else if (borderMode === 'bounce') {
            if (x < 0 || x > screenWidth) {
                vx = -vx * 0.8;
                x = Math.max(0, Math.min(screenWidth, x));
            }
        } else {
            // normal / concrete
            if (x < 0 || x > screenWidth) {
                return { hitTarget: false, overshot: true, minDist, x, y };
            }
        }

        const dx = x - targetX;
        const dy = y - (targetY - 10);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) minDist = dist;

        if (dist < targetRadius) {
            return { hitTarget: true, overshot: false, minDist, x, y };
        }

        // Past target vertically
        if (y > targetY + 100 && vy > 0) {
            const distX = (x - targetX) * direction;
            return { hitTarget: false, overshot: distX > 0, minDist, x, y };
        }

        if (isSolid(terrainMask, width, height, x, y) || y > screenHeight) {
            const distX = (x - targetX) * direction;
            return { hitTarget: false, overshot: distX > 0, minDist, x, y };
        }
    }

    const finalDist = (x - targetX) * direction;
    return { hitTarget: false, overshot: finalDist > 0, minDist, x, y };
}

function solve(req: SolveRequest): SolveResponse {
    const { minAngle, maxAngle, angleStep, powerSteps, preferLowArc, safeDistance, tankX, tankY } = req;
    const targetIsRight = req.targetX > req.startX;

    let searchMin = targetIsRight ? 0 : 80;
    let searchMax = targetIsRight ? 100 : 180;
    searchMin = Math.max(minAngle, searchMin);
    searchMax = Math.min(maxAngle, searchMax);

    const angles: number[] = [];
    for (let a = searchMin; a <= searchMax; a += angleStep) angles.push(a);

    if (preferLowArc) {
        const ideal = targetIsRight ? 0 : 180;
        angles.sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal));
    } else {
        angles.sort((a, b) => Math.abs(a - 90) - Math.abs(b - 90));
    }

    let bestMiss: { angle: number; power: number; dist: number } | null = null;

    for (const angle of angles) {
        let low = 0;
        let high = 10000;

        for (let i = 0; i < powerSteps; i++) {
            const power = (low + high) / 2;
            const result = simulateShot(req, angle, power);

            if (result.hitTarget) {
                const impactDx = result.x - tankX;
                const impactDy = result.y - tankY;
                const impactDist = Math.sqrt(impactDx * impactDx + impactDy * impactDy);
                if (impactDist > safeDistance) {
                    return { id: req.id, angle, power };
                }
            }

            if (result.minDist !== Infinity) {
                const missDx = result.x - tankX;
                const missDy = result.y - tankY;
                const missDist = Math.sqrt(missDx * missDx + missDy * missDy);
                if (missDist > safeDistance) {
                    if (!bestMiss || result.minDist < bestMiss.dist) {
                        bestMiss = { angle, power, dist: result.minDist };
                    }
                }
            }

            if (result.overshot) high = power;
            else low = power;
        }
    }

    if (bestMiss) {
        return { id: req.id, angle: bestMiss.angle, power: bestMiss.power };
    }
    return { id: req.id, angle: null, power: null };
}

// ---- worker message handler -------------------------------------------------

self.onmessage = (e: MessageEvent<SolveRequest>) => {
    const response = solve(e.data);
    self.postMessage(response);
};
