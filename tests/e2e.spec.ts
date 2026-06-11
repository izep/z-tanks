import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-end tests driving the real game in a browser.
 * Game state is inspected through the `window.game` handle exposed in main.ts.
 */

const getPhase = (page: Page) =>
    page.evaluate(() => (window as any).game.state.phase as string);

/** Navigates from the main menu to the setup screen. */
async function openSetup(page: Page) {
    await page.goto('/');
    await expect(page.locator('#btn-menu-new')).toBeVisible();
    await page.locator('#btn-menu-new').click();
    await expect(page.locator('#btn-start-game')).toBeVisible();
}

/** Starts a 2-player game. Both players human so turns stay deterministic. */
async function startTwoHumanGame(page: Page) {
    await openSetup(page);

    // Make Player 2 human (defaults to AI)
    await page.locator('#p-type-1').selectOption('human');
    await page.locator('#btn-start-game').click();

    await expect.poll(() => getPhase(page)).toBe('AIMING');

    // Wait for tanks to land so movement/aim behave consistently
    await expect.poll(() =>
        page.evaluate(() => (window as any).game.state.tanks.every((t: any) => t.hasLanded))
    ).toBe(true);
}

test.describe('App shell', () => {
    test('loads to the main menu', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', err => errors.push(err.message));

        await page.goto('/');

        await expect(page).toHaveTitle(/Z-Tanks/);
        await expect(page.locator('#game-canvas')).toBeVisible();
        await expect(page.locator('#ui-layer')).toBeVisible();
        await expect(page.locator('#menu-layer')).toBeVisible();
        await expect(page.locator('#btn-menu-new')).toBeVisible();
        await expect(page.locator('#btn-menu-help')).toBeVisible();

        expect(errors).toEqual([]);
    });

    test('menu opens the help overlay and the setup screen', async ({ page }) => {
        await page.goto('/');

        await page.locator('#btn-menu-help').click();
        await expect(page.locator('#help-layer')).toBeVisible();
        await page.locator('#btn-help-close').click();
        await expect(page.locator('#help-layer')).toBeHidden();

        await page.locator('#btn-menu-new').click();
        await expect(page.locator('#setup-layer')).toBeVisible();
        await expect(page.locator('#menu-layer')).toBeHidden();
    });

    test('setup screen exposes game options', async ({ page }) => {
        await openSetup(page);

        await expect(page.locator('#setup-p-count')).toBeVisible();
        await expect(page.locator('#setup-rounds')).toBeVisible();
        await expect(page.locator('#setup-borders')).toBeVisible();
        await expect(page.locator('#setup-wind')).toBeVisible();
        await expect(page.locator('#setup-gravity')).toBeVisible();
        await expect(page.locator('#setup-cash')).toBeVisible();

        // Wind and gravity offer the documented choices (Requirements 3.1)
        await expect(page.locator('#setup-wind option')).toHaveCount(3);
        await expect(page.locator('#setup-gravity option')).toHaveCount(3);

        // Economy, arms level, talking tanks, and audio options
        await expect(page.locator('#setup-volatility')).toBeVisible();
        await expect(page.locator('#setup-interest')).toBeVisible();
        await expect(page.locator('#setup-arms')).toBeVisible();
        await expect(page.locator('#setup-talking')).toBeVisible();
        await expect(page.locator('#setup-volume')).toBeVisible();
        await expect(page.locator('#setup-music')).toBeVisible();
    });

    test('arms level and economy options apply to game state', async ({ page }) => {
        await openSetup(page);
        await page.locator('#p-type-1').selectOption('human');
        await page.locator('#setup-arms').selectOption('1');
        await page.locator('#setup-interest').selectOption('0.20');
        await page.locator('#setup-talking').uncheck();
        await page.locator('#btn-start-game').click();

        await expect.poll(() => getPhase(page)).toBe('AIMING');

        const snapshot = await page.evaluate(() => {
            const s = (window as any).game.state;
            return { armsLevel: s.armsLevel, interestRate: s.interestRate, talkingTanks: s.talkingTanks };
        });
        expect(snapshot.armsLevel).toBe(1);
        expect(snapshot.interestRate).toBeCloseTo(0.20, 5);
        expect(snapshot.talkingTanks).toBe(false);
    });
});

test.describe('Game start', () => {
    test('starting a game shows the HUD and enters AIMING', async ({ page }) => {
        await startTwoHumanGame(page);

        await expect(page.locator('#setup-layer')).toBeHidden();
        await expect(page.locator('#hud')).toBeVisible();
        await expect(page.locator('#p-name')).toHaveText('Player 1');

        // Touch controls present: d-pad, movement, fire, battery, mute
        await expect(page.locator('#btn-move-left')).toBeVisible();
        await expect(page.locator('#btn-move-right')).toBeVisible();
        await expect(page.locator('#btn-battery')).toBeVisible();
        await expect(page.locator('#btn-mute')).toBeVisible();

        const tankCount = await page.evaluate(() => (window as any).game.state.tanks.length);
        expect(tankCount).toBe(2);
    });

    test('applies setup options to game state', async ({ page }) => {
        await openSetup(page);
        await page.locator('#p-type-1').selectOption('human');
        await page.locator('#setup-wind').selectOption('none');
        await page.locator('#setup-gravity').selectOption('high');
        await page.locator('#setup-cash').fill('25000');
        await page.locator('#btn-start-game').click();

        await expect.poll(() => getPhase(page)).toBe('AIMING');

        const snapshot = await page.evaluate(() => {
            const s = (window as any).game.state;
            return { wind: s.wind, gravity: s.gravity, credits: s.tanks[0].credits };
        });
        expect(snapshot.wind).toBe(0);
        expect(snapshot.gravity).toBeCloseTo(98 * 1.5, 3);
        expect(snapshot.credits).toBe(25000);
    });
});

test.describe('Aiming controls', () => {
    test('arrow keys adjust angle and power in the HUD', async ({ page }) => {
        await startTwoHumanGame(page);

        const angleBefore = await page.evaluate(() => (window as any).game.state.tanks[0].angle);
        await page.keyboard.down('ArrowLeft');
        await page.waitForTimeout(400);
        await page.keyboard.up('ArrowLeft');
        const angleAfter = await page.evaluate(() => (window as any).game.state.tanks[0].angle);
        expect(angleAfter).not.toBe(angleBefore);

        const powerBefore = await page.evaluate(() => (window as any).game.state.tanks[0].power);
        await page.keyboard.down('ArrowDown');
        await page.waitForTimeout(400);
        await page.keyboard.up('ArrowDown');
        const powerAfter = await page.evaluate(() => (window as any).game.state.tanks[0].power);
        expect(powerAfter).toBeLessThan(powerBefore);
    });

    test('power can never exceed the 10000 cap', async ({ page }) => {
        await startTwoHumanGame(page);

        // Hold power-up well past the cap
        await page.keyboard.down('ArrowUp');
        await page.waitForTimeout(2500);
        await page.keyboard.up('ArrowUp');

        const power = await page.evaluate(() => (window as any).game.state.tanks[0].power);
        expect(power).toBeLessThanOrEqual(10000);
    });

    test('Tab cycles to the next weapon', async ({ page }) => {
        await startTwoHumanGame(page);

        const before = await page.evaluate(() => (window as any).game.state.tanks[0].currentWeapon);
        await page.keyboard.press('Tab');
        await expect.poll(() =>
            page.evaluate(() => (window as any).game.state.tanks[0].currentWeapon)
        ).not.toBe(before);
    });
});

test.describe('Firing', () => {
    test('space fires a projectile and the turn passes to the next player', async ({ page }) => {
        await startTwoHumanGame(page);

        await page.keyboard.press(' ');

        // A projectile takes flight
        await expect.poll(() => getPhase(page)).toBe('PROJECTILE_FLYING');

        // Eventually the shot resolves and play continues (next player's turn)
        await expect.poll(async () => {
            const s = await page.evaluate(() => {
                const st = (window as any).game.state;
                return { phase: st.phase, idx: st.currentPlayerIndex };
            });
            return s.phase === 'AIMING' && s.idx === 1;
        }, { timeout: 20000 }).toBe(true);

        await expect(page.locator('#p-name')).toHaveText('Player 2');
    });

    test('a full exchange damages or moves play forward without errors', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', err => errors.push(err.message));

        await startTwoHumanGame(page);

        // Both players fire once
        for (let i = 0; i < 2; i++) {
            await page.keyboard.press(' ');
            await expect.poll(async () => {
                const phase = await getPhase(page);
                return phase === 'AIMING' || phase === 'SHOP' || phase === 'GAME_OVER';
            }, { timeout: 20000 }).toBe(true);
        }

        expect(errors).toEqual([]);
    });
});

test.describe('Guidance systems', () => {
    test('guidance button arms guidance and firing consumes one unit', async ({ page }) => {
        await startTwoHumanGame(page);

        // Grant guidance hardware
        await page.evaluate(() => {
            const tank = (window as any).game.state.tanks[0];
            tank.accessories['heat_guidance'] = 2;
        });

        // HUD row appears once owned
        await expect(page.locator('#row-guidance')).toBeVisible();
        await expect(page.locator('#p-guidance')).toContainText('Off');

        // Click the guidance button to arm
        await page.locator('#btn-guidance').click();
        await expect(page.locator('#p-guidance')).toContainText('Heat Guidance (ON)');

        // Fire: one unit consumed, projectile carries guidance
        await page.keyboard.press(' ');
        await expect.poll(() => getPhase(page)).toBe('PROJECTILE_FLYING');

        const result = await page.evaluate(() => {
            const s = (window as any).game.state;
            return {
                remaining: s.tanks[0].accessories['heat_guidance'],
                projectileGuidance: s.projectiles[0]?.guidance ?? null
            };
        });
        expect(result.remaining).toBe(1);
        expect(result.projectileGuidance).toBe('heat_guidance');
    });
});

test.describe('Save / Load', () => {
    test('autosaves on game start and resumes after a reload', async ({ page }) => {
        await startTwoHumanGame(page);

        // The SETUP -> AIMING transition triggers the first autosave
        const hasSave = await page.evaluate(() => (window as any).game.saveSystem.hasSave());
        expect(hasSave).toBe(true);

        // Make the state distinctive, then persist it synchronously
        await page.evaluate(() => {
            const game = (window as any).game;
            game.state.tanks[0].credits = 77777;
            game.state.roundNumber = 4;
            game.saveSystem.saveSync(game.state, game.terrainSystem, game.economySystem);
        });

        // Fresh page load: the main menu offers to continue
        await page.reload();
        await expect(page.locator('#btn-menu-continue')).toBeVisible();
        await page.locator('#btn-menu-continue').click();

        await expect.poll(() => getPhase(page)).toBe('AIMING');
        const snapshot = await page.evaluate(() => {
            const s = (window as any).game.state;
            return { credits: s.tanks[0].credits, round: s.roundNumber, tankCount: s.tanks.length };
        });
        expect(snapshot.credits).toBe(77777);
        expect(snapshot.round).toBe(4);
        expect(snapshot.tankCount).toBe(2);

        // HUD reflects the restored game
        await expect(page.locator('#p-credits')).toHaveText('77777');
    });
});

test.describe('Pause', () => {
    test('Esc pauses (freezing the game) and the pause menu resumes or quits', async ({ page }) => {
        await startTwoHumanGame(page);

        await page.keyboard.press('Escape');
        await expect(page.locator('#pause-layer')).toBeVisible();
        expect(await page.evaluate(() => (window as any).game.state.isPaused)).toBe(true);

        // Simulation is frozen: aiming input has no effect while paused
        const angleBefore = await page.evaluate(() => (window as any).game.state.tanks[0].angle);
        await page.keyboard.down('ArrowLeft');
        await page.waitForTimeout(300);
        await page.keyboard.up('ArrowLeft');
        const angleAfter = await page.evaluate(() => (window as any).game.state.tanks[0].angle);
        expect(angleAfter).toBe(angleBefore);

        // Resume via the pause menu
        await page.locator('#btn-pause-resume').click();
        await expect(page.locator('#pause-layer')).toBeHidden();
        expect(await page.evaluate(() => (window as any).game.state.isPaused)).toBe(false);

        // Pause via the on-screen button, then quit to the main menu
        await page.locator('#btn-pause').click();
        await expect(page.locator('#pause-layer')).toBeVisible();
        await page.locator('#btn-pause-quit').click();
        await expect(page.locator('#menu-layer')).toBeVisible();

        // The game was saved on the way out, so Continue is offered
        await expect(page.locator('#btn-menu-continue')).toBeVisible();
    });

    test('Esc does nothing on the main menu', async ({ page }) => {
        await page.goto('/');
        await page.keyboard.press('Escape');
        await expect(page.locator('#pause-layer')).toBeHidden();
        await expect(page.locator('#menu-layer')).toBeVisible();
    });
});

test.describe('Shield', () => {
    test('S activates a shield from inventory', async ({ page }) => {
        await startTwoHumanGame(page);

        await page.evaluate(() => {
            const tank = (window as any).game.state.tanks[0];
            tank.accessories['shield'] = 1;
        });

        await page.keyboard.press('s');

        await expect.poll(() =>
            page.evaluate(() => {
                const t = (window as any).game.state.tanks[0];
                return t.activeShield === 'shield' && t.shieldHealth === 200;
            })
        ).toBe(true);
    });
});
