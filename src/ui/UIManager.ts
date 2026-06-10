import { GamePhase, type GameState } from '../core/GameState';
import { WEAPON_ORDER, WEAPONS, GUIDANCE_ORDER } from '../core/WeaponData';

export class UIManager {
    private container: HTMLElement;
    private shopContainer: HTMLDivElement | null = null;
    private setupContainer: HTMLDivElement | null = null;
    private lastPhase: GamePhase | null = null;

    // Callbacks
    public onBuyWeapon: (weaponId: string) => void = () => { };
    public onSellWeapon: (weaponId: string) => void = () => { };
    public onNextRound: () => void = () => { };
    public onStartGame: (config: any) => void = () => { };
    public onRestartGame: () => void = () => { };
    public onAction: (action: string, active: boolean) => void = () => { };
    public getPrice: (weaponId: string) => number = (weaponId) => WEAPONS[weaponId]?.cost || 0;

    constructor() {
        this.container = document.getElementById('ui-layer')!;
        this.setupBaseUI();
        this.bindLongPressControls();
    }

    private setupBaseUI() {
        this.container.innerHTML = `
      <!-- Top Left HUD -->
      <div id="hud" class="hud-panel" style="position: absolute; top: 5px; left: 5px; min-width: 200px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
            <div style="font-size: 18px; font-weight: bold;" id="p-name">Player Name</div>
        </div>
        
        <div class="stat-row">
            <span class="stat-label"><i class="fa-solid fa-gear"></i> Angle</span>
            <span class="stat-value" id="p-angle">0</span>
        </div>
        <div class="stat-row">
            <span class="stat-label"><i class="fa-solid fa-bolt"></i> Power</span>
            <span class="stat-value" id="p-power">0</span>
        </div>
        <div class="stat-row">
            <span class="stat-label"><i class="fa-solid fa-bomb"></i> Weapon</span>
            <span class="stat-value" id="p-weapon" style="color: #4db8ff;">-</span>
        </div>
        <div class="stat-row">
            <span class="stat-label"><i class="fa-solid fa-heart"></i> Health</span>
            <span class="stat-value" id="p-health">100</span>
        </div>
        <div class="stat-row">
            <span class="stat-label"><i class="fa-solid fa-shield-alt"></i> Shield</span>
            <span class="stat-value" id="p-shield">100</span>
        </div>
        <div class="stat-row">
            <span class="stat-label"><i class="fa-solid fa-coins"></i> Credits</span>
            <span class="stat-value" id="p-credits" style="color: gold;">0</span>
        </div>
        <div class="stat-row">
            <span class="stat-label"><i class="fa-solid fa-wind"></i> Wind</span>
            <span class="stat-value" id="p-wind">0.0</span>
        </div>
        <div class="stat-row" id="row-guidance" style="display: none;">
            <span class="stat-label"><i class="fa-solid fa-crosshairs"></i> Guidance</span>
            <span class="stat-value" id="p-guidance">-</span>
        </div>
      </div>
      
      <!-- ... Center Message ... -->
      <div id="turn-message" style="position: absolute; top: 30%; left: 50%; transform: translate(-50%, -50%); color: gold; display: none; pointer-events: none; text-align: center;">
      </div>
      
      <!-- ... D-Pad ... -->
      <div id="controls-left" class="control-cluster bottom-left">
        <div class="d-pad-grid">
            <div></div>
            <div class="d-pad-btn" id="btn-up"><span>▲</span></div>
            <div></div>
            
            <div class="d-pad-btn" id="btn-left"><span>◀</span></div>
            <div class="d-pad-btn" id="btn-fire-small" style="font-size:12px;">🔥</div>
            <div class="d-pad-btn" id="btn-right"><span>▶</span></div>
            
            <div></div>
            <div class="d-pad-btn" id="btn-down"><span>▼</span></div>
            <div></div>
        </div>
      </div>

      <!-- Bottom Right Controls (Actions) -->
      <div id="controls-right" class="control-cluster bottom-right">
        <div class="btn-circle btn-yellow" id="btn-weapon" title="Switch Weapon">
            <i class="fa-solid fa-bomb" style="font-size:32px;"></i>
        </div>
        <div class="btn-circle btn-blue" id="btn-shield" title="Shield">
            <i class="fa-solid fa-shield-alt" style="font-size:32px;"></i>
        </div>
        <div class="btn-circle btn-green" id="btn-guidance" title="Guidance">
            <i class="fa-solid fa-crosshairs" style="font-size:32px;"></i>
        </div>
      </div>
      
      <!-- Screens (Shop / Setup) -->
      <div id="shop-layer" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); color: white; pointer-events: auto; flex-direction: column;">
        <div id="shop-content" style="flex: 1; overflow-y: auto; padding: 20px; box-sizing: border-box;">
            <h1 style="text-align: center; color: gold; font-family: 'Inter', sans-serif;">Weapon Shop</h1>
            <div id="shop-player-status" style="margin-bottom: 20px; max-width: 800px; margin-left: auto; margin-right: auto; border-bottom: 1px solid #444; padding-bottom: 10px;"></div>
            <div id="shop-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; max-width: 1000px; margin: 0 auto;"></div>
        </div>
        <div id="shop-footer" style="padding: 20px; background: rgba(20, 20, 25, 0.9); border-top: 1px solid #444; text-align: center; backdrop-filter: blur(10px);">
            <button id="btn-next-round" style="padding: 12px 40px; font-size: 18px; cursor: pointer; background: gold; border: none; color: black; font-weight: bold; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">Next Round</button>
        </div>
      </div>
    `;

        this.shopContainer = document.getElementById('shop-layer') as HTMLDivElement;

        // Bind Next Round
        document.getElementById('btn-next-round')?.addEventListener('click', () => {
            this.onNextRound();
        });

        // D-Pad and Fire are handled by TouchControls.ts;
        // Weapon and Shield buttons by bindLongPressControls().

        // Add Enter Key Listener for Shop and Game Over
        window.addEventListener('keydown', (e) => {
            if (this.shopContainer && this.shopContainer.style.display === 'block') {
                if (e.key === 'Enter') {
                    this.onNextRound();
                }
            } else if (document.getElementById('turn-message')?.style.display === 'block' && document.getElementById('turn-message')?.innerText.includes('GAME OVER')) {
                if (e.key === 'Enter') {
                    this.onRestartGame();
                }
            }
        });

        // Setup Screen
        const setupDiv = document.createElement('div');
        setupDiv.id = 'setup-layer';
        setupDiv.style.cssText = 'display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #222; color: white; padding: 40px; text-align: center; pointer-events: auto; z-index: 2000;';
        setupDiv.innerHTML = `
            <h1>Setup Game</h1>
            <div style="margin: 20px;">
                <label>Player Count: <input type="number" id="setup-p-count" value="2" min="2" max="6" style="padding: 5px; width: 50px; text-align: center;"></label>
            </div>
            <div id="setup-players" style="margin: 20px; display: grid; grid-template-columns: 1fr; gap: 10px; max-height: 400px; overflow-y: auto;"></div>
            
            <div style="margin: 20px;">
                 <label>Rounds: <input type="number" id="setup-rounds" value="10" min="1" max="20" style="padding: 5px; width: 50px; text-align: center;"></label>
                 <br><br>
                 <label>Borders:
                    <select id="setup-borders" style="padding: 5px;">
                        <option value="normal">Normal</option>
                        <option value="wrap">Wrap Around</option>
                        <option value="bounce">Bounce</option>
                        <option value="concrete">Concrete (Explode)</option>
                    </select>
                 </label>
                 <br><br>
                 <label>Wind:
                    <select id="setup-wind" style="padding: 5px;">
                        <option value="none">None</option>
                        <option value="normal" selected>Normal</option>
                        <option value="strong">Strong</option>
                    </select>
                 </label>
                 <label style="margin-left: 15px;">Gravity:
                    <select id="setup-gravity" style="padding: 5px;">
                        <option value="low">Low (Moon)</option>
                        <option value="normal" selected>Normal</option>
                        <option value="high">High</option>
                    </select>
                 </label>
                 <br><br>
                 <label>Starting Cash: $<input type="number" id="setup-cash" value="10000" min="0" max="1000000" step="1000" style="padding: 5px; width: 90px; text-align: center;"></label>
                 <br><br>
                 <label><input type="checkbox" id="setup-test-mode"> Test Mode (100 Weapons)</label>
            </div>

            <button id="btn-start-game" style="padding: 10px 20px; font-size: 20px; cursor: pointer;">START GAME</button>
        `;
        this.container.appendChild(setupDiv);
        this.setupContainer = setupDiv;

        // Dynamic Player List
        const countInput = document.getElementById('setup-p-count') as HTMLInputElement;
        const playersDiv = document.getElementById('setup-players')!;

        const updatePlayerRows = () => {
            const count = parseInt(countInput.value) || 2;
            playersDiv.innerHTML = '';
            for (let i = 0; i < count; i++) {
                const row = document.createElement('div');
                row.style.cssText = 'display: flex; gap: 10px; align-items: center; justify-content: center; background: #333; padding: 10px; border-radius: 5px;';

                // Name
                row.innerHTML = `
                    <span style="font-weight: bold; width: 20px;">${i + 1}</span>
                    <input type="text" id="p-name-${i}" value="Player ${i + 1}" placeholder="Name" style="padding: 5px; width: 100px;">
                    
                    <select id="p-type-${i}" style="padding: 5px;">
                        <option value="human" ${i === 0 ? 'selected' : ''}>Human</option>
                        <option value="ai" ${i > 0 ? 'selected' : ''}>AI</option>
                    </select>

                    <select id="p-ai-style-${i}" style="padding: 5px; display: ${i > 0 ? 'block' : 'none'};">
                        <option value="MORON">Moron</option>
                        <option value="SHOOTER">Shooter</option>
                        <option value="POOLSHARK">Poolshark</option>
                        <option value="TOSSER" selected>Tosser</option>
                        <option value="CHOOSER">Chooser</option>
                        <option value="SPOILER">Spoiler</option>
                        <option value="CYBORG">Cyborg</option>
                        <option value="UNKNOWN">Unknown</option>
                    </select>

                    <label>Tank: 
                        <select id="p-variant-${i}" style="padding: 5px;">
                            <option value="0">Classic</option>
                            <option value="1">Heavy</option>
                            <option value="2">Sci-Fi</option>
                            <option value="3">Hover</option>
                            <option value="4">Retro</option>
                            <option value="5">Spiky</option>
                            <option value="6">Triple Turret (AI)</option>
                        </select>
                    </label>
                `;

                // Toggle AI Select visibility based on type
                const typeSel = row.querySelector(`#p-type-${i}`) as HTMLSelectElement;
                const aiSel = row.querySelector(`#p-ai-style-${i}`) as HTMLElement;
                typeSel.onchange = () => {
                    aiSel.style.display = typeSel.value === 'ai' ? 'block' : 'none';
                };

                playersDiv.appendChild(row);
            }
        };

        countInput.onchange = updatePlayerRows;
        // Init
        updatePlayerRows();

        document.getElementById('btn-start-game')?.addEventListener('click', () => {
            // Read config
            const count = parseInt((document.getElementById('setup-p-count') as HTMLInputElement).value);
            const rounds = parseInt((document.getElementById('setup-rounds') as HTMLInputElement).value) || 10;

            const players: any[] = [];
            for (let i = 0; i < count; i++) {
                const name = (document.getElementById(`p-name-${i}`) as HTMLInputElement).value;
                const type = (document.getElementById(`p-type-${i}`) as HTMLSelectElement).value;
                const aiStyle = (document.getElementById(`p-ai-style-${i}`) as HTMLSelectElement).value;
                const variant = parseInt((document.getElementById(`p-variant-${i}`) as HTMLSelectElement).value);

                players.push({
                    name,
                    isAi: type === 'ai',
                    aiPersonality: type === 'ai' ? aiStyle : undefined,
                    variant
                });
            }

            const testMode = (document.getElementById('setup-test-mode') as HTMLInputElement).checked;
            const borders = (document.getElementById('setup-borders') as HTMLSelectElement).value;
            const wind = (document.getElementById('setup-wind') as HTMLSelectElement).value;
            const gravity = (document.getElementById('setup-gravity') as HTMLSelectElement).value;
            const startingCash = parseInt((document.getElementById('setup-cash') as HTMLInputElement).value);

            const config = {
                playerCount: count,
                rounds,
                players,
                testMode,
                borders,
                wind,
                gravity,
                startingCash: Number.isFinite(startingCash) ? startingCash : undefined
            };
            this.onStartGame(config);
        });
    }

    private handlePhaseChange(state: GameState) {
        const hud = document.getElementById('hud');
        const controlsLeft = document.getElementById('controls-left');
        const controlsRight = document.getElementById('controls-right');

        if (state.phase === 'SHOP') {
            this.shopContainer!.style.display = 'flex';
            this.buildShopGrid();
            if (hud) hud.style.display = 'none';
            if (controlsLeft) controlsLeft.style.display = 'none';
            if (controlsRight) controlsRight.style.display = 'none';
        } else if (state.phase === 'SETUP') {
            this.setupContainer!.style.display = 'block';
            this.shopContainer!.style.display = 'none';
            if (hud) hud.style.display = 'none';
            if (controlsLeft) controlsLeft.style.display = 'none';
            if (controlsRight) controlsRight.style.display = 'none';
        } else {
            this.shopContainer!.style.display = 'none';
            this.setupContainer!.style.display = 'none';
            if (hud) hud.style.display = 'block';
            if (controlsLeft) controlsLeft.style.display = 'flex';
            if (controlsRight) controlsRight.style.display = 'flex';
        }
    }

    private buildShopGrid() {
        const grid = document.getElementById('shop-grid')!;
        grid.innerHTML = ''; // Clear

        const categoryHeaders: Record<string, string> = {
            'baby_missile': 'Standard Weapons',
            'riot_charge': 'Earth Destroying',
            'dirt_clod': 'Earth Producing',
            'plasma_blast': 'Energy Weapons',
            'napalm': 'Other Weapons',
            'fuel_can': 'Items & Accessories'
        };

        WEAPON_ORDER.forEach(key => {
            // Insert category header if this key marks the start of a new category
            if (categoryHeaders[key]) {
                const header = document.createElement('h3');
                header.textContent = categoryHeaders[key];
                header.style.gridColumn = '1 / -1'; // Span full width
                header.style.color = '#gold';
                header.style.borderBottom = '1px solid #444';
                header.style.paddingBottom = '5px';
                header.style.marginTop = '20px';
                grid.appendChild(header);
            }

            const weapon = WEAPONS[key];
            const price = this.getPrice(key);
            const card = document.createElement('div');
            card.style.border = '1px solid #444';
            card.style.padding = '10px';
            card.style.backgroundColor = '#222';
            card.style.cursor = 'pointer';

            card.innerHTML = `
                <div style="display: flex; align-items: center; margin-bottom: 5px;">
                    <img src="${this.getWeaponIconPath(key)}" style="width: 32px; height: 32px; margin-right: 8px;">
                    <div style="font-weight: bold; color: ${weapon.color}">${weapon.name}</div>
                </div>
                <div style="font-size: 12px; color: #aaa; margin-bottom: 5px;">${weapon.description}</div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="color: gold;">$${price}${weapon.bundleSize > 1 ? ` (x${weapon.bundleSize})` : ''}</div>
                    <div id="shop-count-${key}" style="color: white;">x0</div>
                </div>
                <button id="shop-sell-${key}" style="margin-top: 6px; width: 100%; padding: 3px; font-size: 11px; background: #553333; color: #ddd; border: 1px solid #775555; border-radius: 3px; cursor: pointer; display: none;">Sell 1</button>
            `;

            card.onclick = () => {
                this.onBuyWeapon(key);
            };

            const sellBtn = card.querySelector(`#shop-sell-${key}`) as HTMLButtonElement;
            sellBtn.onclick = (e) => {
                e.stopPropagation(); // Don't trigger the buy handler
                this.onSellWeapon(key);
            };

            grid.appendChild(card);
        });
    }

    private updateShopUI(state: GameState) {
        const tank = state.tanks[state.currentPlayerIndex];
        if (!tank) return;

        // Header
        const statusDiv = document.getElementById('shop-player-status')!;
        statusDiv.innerHTML = `
            <span style="font-size: 20px; color: ${tank.color}">${tank.name}</span>
            <span style="float: right; color: gold;">Credits: $${tank.credits}</span>
        `;

        const btn = document.getElementById('btn-next-round') as HTMLButtonElement;
        btn.innerText = "Done Shopping / Next Round";

        // Update quantities
        WEAPON_ORDER.forEach(key => {
            const countEl = document.getElementById(`shop-count-${key}`);
            if (countEl) {
                const isItem = WEAPONS[key]?.type === 'item';
                const count = key === 'fuel_can'
                    ? tank.fuel
                    : (isItem ? (tank.accessories[key] || 0) : (tank.inventory[key] || 0));
                countEl.innerText = count === -1 ? 'INF' : `x${count}`;

                const sellBtn = document.getElementById(`shop-sell-${key}`) as HTMLButtonElement | null;
                if (sellBtn) {
                    const sellable = key !== 'fuel_can' && count > 0;
                    sellBtn.style.display = sellable ? 'block' : 'none';
                }
            }
        });
    }

    // --- Selection UI ---

    private setupLongPress(elementId: string, onClick: () => void, onLongPress: () => void) {
        const element = document.getElementById(elementId);
        if (!element) return;

        let timer: any;
        let isLongPress = false;
        const DURATION = 500;

        const start = () => {
            isLongPress = false;
            timer = setTimeout(() => {
                isLongPress = true;
                onLongPress();
            }, DURATION);
        };

        const end = () => {
            clearTimeout(timer);
            if (!isLongPress) {
                onClick();
            }
        };

        const cancel = () => {
            clearTimeout(timer);
        };

        element.addEventListener('mousedown', start);
        element.addEventListener('touchstart', start);

        element.addEventListener('mouseup', end);
        element.addEventListener('touchend', end);

        element.addEventListener('mouseleave', cancel);
        element.addEventListener('touchcancel', cancel);
    }

    public bindLongPressControls() {
        // Weapon: Click -> Switch (Next), Long -> Menu
        this.setupLongPress('btn-weapon', () => {
            // Standard click behavior (Next Weapon)
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
            setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab' })), 50);
        }, () => {
            this.showWeaponSelector();
        });

        // Shield: Click -> Toggle, Long -> Menu
        this.setupLongPress('btn-shield', () => {
            // Toggle shield
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
            setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 's' })), 50);
        }, () => {
            this.showShieldSelector();
        });

        // Guidance: Click -> Toggle (strongest owned), Long -> Menu
        this.setupLongPress('btn-guidance', () => {
            const tank = this.getTank();
            if (!tank) return;
            if (tank.activeGuidance) {
                this.onSetGuidance(null); // Disarm
            } else {
                const best = GUIDANCE_ORDER.find(id => (tank.accessories[id] || 0) > 0);
                if (best) this.onSetGuidance(best);
            }
        }, () => {
            this.showGuidanceSelector();
        });
    }

    private showGuidanceSelector() {
        const tank = this.getTank();
        if (!tank) return;

        const available = GUIDANCE_ORDER.filter(k => (tank.accessories[k] || 0) > 0);
        if (available.length === 0) return;

        this.renderSelector(available, (id) => this.onSetGuidance(id));
    }

    private showWeaponSelector() {
        const tank = this.getTank();
        if (!tank) return;

        // Filter weapons
        const available = Object.keys(tank.inventory).filter(k => {
            const w = WEAPONS[k];
            return w && w.type !== 'item' && tank.inventory[k] !== 0;
        });

        // Sort by order
        available.sort((a, b) => WEAPON_ORDER.indexOf(a) - WEAPON_ORDER.indexOf(b));

        this.renderSelector(available, (id) => this.triggerWeaponSelect(id));
    }

    private showShieldSelector() {
        const tank = this.getTank();
        if (!tank) return;

        // Show shields
        const available = ['shield', 'heavy_shield'].filter(k => (tank.accessories[k] || 0) > 0);

        if (available.length === 0) {
            console.log("No shields available");
            return;
        }

        this.renderSelector(available, (id) => this.triggerShieldSelect(id));
    }

    private renderSelector(items: string[], onSelect: (id: string) => void) {
        const existing = document.getElementById('selector-overlay');
        if (existing) document.body.removeChild(existing);

        const overlay = document.createElement('div');
        overlay.id = 'selector-overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 3000; display: flex; flex-direction: column; align-items: center; justify-content: center;';

        overlay.onclick = (e) => {
            if (e.target === overlay) document.body.removeChild(overlay);
        }

        const title = document.createElement('h2');
        title.innerText = "Select Item";
        title.style.color = "gold";
        overlay.appendChild(title);

        const container = document.createElement('div');
        container.style.cssText = 'background: #222; border: 1px solid #555; padding: 20px; border-radius: 10px; max-width: 90%; max-height: 70vh; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.5);';

        items.forEach(id => {
            const w = WEAPONS[id];
            if (!w) return;
            const tank = this._lastState?.tanks[this._lastState.currentPlayerIndex];
            // Safe access for count
            let count = 0;
            if (tank) {
                if (tank.inventory[id] !== undefined) count = tank.inventory[id];
                else if (tank.accessories[id] !== undefined) count = tank.accessories[id];
            }

            const item = document.createElement('div');
            item.style.cssText = 'display: flex; flex-direction: column; align-items: center; padding: 8px; border: 1px solid #444; border-radius: 4px; cursor: pointer; background: #333; transition: all 0.2s;';
            item.innerHTML = `
                <img src="${this.getWeaponIconPath(id)}" style="width: 48px; height: 48px; margin-bottom: 5px;">
                <span style="font-size: 12px; font-weight: bold; color: ${w.color}; text-align: center;">${w.name}</span>
                <span style="font-size: 10px; color: #ccc;">${count === -1 ? 'INF' : 'x' + count}</span>
            `;

            item.onmouseover = () => item.style.background = '#444';
            item.onmouseout = () => item.style.background = '#333';

            item.onclick = () => {
                onSelect(id);
                document.body.removeChild(overlay);
            };

            container.appendChild(item);
        });

        overlay.appendChild(container);
        document.body.appendChild(overlay);
    }

    // Cached state for UI helpers
    private _lastState: GameState | null = null;
    private _domCache: Record<string, string | number | boolean> = {};

    public update(state: GameState) {
        this._lastState = state;

        // Phase Change Detection
        if (this.lastPhase !== state.phase) {
            this.handlePhaseChange(state);
            this.lastPhase = state.phase;
            // Force refresh when phase changes (optional, but safer)
            this._domCache = {};
        }

        const tank = state.tanks[state.currentPlayerIndex];
        if (tank) {
            if (this._domCache['p-name'] !== tank.name) {
                document.getElementById('p-name')!.innerText = tank.name;
                this._domCache['p-name'] = tank.name;
            }

            const displayAngle = tank.angle <= 90 ? tank.angle : 180 - tank.angle;
            const angleVal = Math.floor(displayAngle);
            if (this._domCache['p-angle'] !== angleVal) {
                document.getElementById('p-angle')!.innerText = angleVal.toString();
                this._domCache['p-angle'] = angleVal;
            }

            const powerVal = Math.floor(tank.power);
            if (this._domCache['p-power'] !== powerVal) {
                document.getElementById('p-power')!.innerText = powerVal.toString();
                this._domCache['p-power'] = powerVal;
            }

            const healthVal = Math.floor(tank.health);
            if (this._domCache['p-health'] !== healthVal) {
                document.getElementById('p-health')!.innerText = healthVal.toString();
                this._domCache['p-health'] = healthVal;
            }

            // Shield
            const sCount = (tank.accessories['shield'] || 0) + (tank.accessories['heavy_shield'] || 0);
            const sActive = tank.activeShield !== undefined;
            const shieldKey = `shield-${sCount}-${sActive}-${tank.shieldHealth ? Math.floor(tank.shieldHealth) : 0}`;

            if (this._domCache['shield-key'] !== shieldKey) {
                this._domCache['shield-key'] = shieldKey;
                const shieldRow = document.getElementById('p-shield')?.parentElement;
                if (shieldRow) {
                    if (sCount <= 0 && !sActive) {
                        shieldRow.style.display = 'none';
                    } else {
                        shieldRow.style.display = 'flex';
                        // Icon
                        const icon = sActive ? '<i class="fa-solid fa-shield-alt" style="color:cyan"></i>' : '<i class="fa-solid fa-shield-alt"></i>';

                        const shieldVal = document.getElementById('p-shield')!;
                        shieldVal.innerHTML = `${icon} `; // Reset

                        if (sActive) {
                            const txt = document.createTextNode(`${Math.floor(tank.shieldHealth || 0)} (ON)`);
                            shieldVal.appendChild(txt);
                            shieldVal.style.color = "cyan";
                        } else {
                            const txt = document.createTextNode(`${sCount}`);
                            shieldVal.appendChild(txt);
                            shieldVal.style.color = "white";
                        }
                    }
                }
            }

            if (this._domCache['p-credits'] !== tank.credits) {
                document.getElementById('p-credits')!.innerText = tank.credits.toString();
                this._domCache['p-credits'] = tank.credits;
            }

            const w = state.wind;
            const arrow = w > 0 ? '→' : (w < 0 ? '←' : '');
            const windDisplay = `${arrow} ${Math.abs(w).toFixed(1)}`;

            if (this._domCache['p-wind'] !== windDisplay) {
                document.getElementById('p-wind')!.innerText = windDisplay;
                this._domCache['p-wind'] = windDisplay;
            }

            const weaponId = tank.currentWeapon || 'missile';
            if (this._domCache['p-weapon'] !== weaponId) {
                const weapon = WEAPONS[weaponId];
                const weaponName = weapon?.name || weaponId;
                const iconPath = this.getWeaponIconPath(weaponId);
                const weaponEl = document.getElementById('p-weapon')!;
                weaponEl.innerHTML = `<img src="${iconPath}" style="width:24px;height:24px;vertical-align:middle; margin-right:5px;"> ${weaponName}`;
                weaponEl.style.color = weapon?.color || '#4db8ff';
                this._domCache['p-weapon'] = weaponId;
            }

            // Guidance HUD row + button state
            const gOwned = GUIDANCE_ORDER.reduce((sum, id) => sum + (tank.accessories[id] || 0), 0);
            const gActive = tank.activeGuidance;
            const guidanceKey = `${gOwned}-${gActive || 'off'}`;
            if (this._domCache['guidance-key'] !== guidanceKey) {
                this._domCache['guidance-key'] = guidanceKey;

                const row = document.getElementById('row-guidance');
                if (row) {
                    if (gOwned <= 0 && !gActive) {
                        row.style.display = 'none';
                    } else {
                        row.style.display = 'flex';
                        const valEl = document.getElementById('p-guidance')!;
                        if (gActive) {
                            valEl.innerText = `${WEAPONS[gActive]?.name || gActive} (ON)`;
                            valEl.style.color = '#66FF99';
                        } else {
                            valEl.innerText = `Off (x${gOwned})`;
                            valEl.style.color = 'white';
                        }
                    }
                }

                const btnGuidance = document.getElementById('btn-guidance');
                if (btnGuidance) {
                    const usable = gOwned > 0 || !!gActive;
                    btnGuidance.style.opacity = usable ? '1' : '0.3';
                    btnGuidance.style.filter = usable ? 'none' : 'grayscale(100%)';
                    btnGuidance.style.cursor = usable ? 'pointer' : 'default';
                    btnGuidance.style.boxShadow = gActive ? '0 0 12px #66FF99' : 'none';
                }
            }

            // Shield Button State
            const btnShieldKey = `btn-shield-${sCount > 0 || sActive}`;
            if (this._domCache['btn-shield'] !== btnShieldKey) {
                this._domCache['btn-shield'] = btnShieldKey;
                const btnShield = document.getElementById('btn-shield');
                if (btnShield) {
                    if (sCount > 0 || sActive) {
                        btnShield.style.opacity = '1';
                        btnShield.style.filter = 'none';
                        btnShield.style.cursor = 'pointer';
                    } else {
                        btnShield.style.opacity = '0.3';
                        btnShield.style.filter = 'grayscale(100%)';
                        btnShield.style.cursor = 'default';
                    }
                }
            }
        }

        const msgEl = document.getElementById('turn-message')!;
        if (state.phase === 'GAME_OVER') {
            let winnerText = "GAME OVER";
            const survivors = state.tanks.filter(t => !t.isDead && t.health > 0);

            if (survivors.length === 1) {
                winnerText = `${survivors[0].name} WINS!`;
            } else if (survivors.length > 1) {
                const sorted = [...survivors].sort((a, b) => b.credits - a.credits);
                winnerText = `${sorted[0].name} WINS!(Most Credits)`;
            } else {
                winnerText = "DRAW!";
            }

            msgEl.innerHTML = `${winnerText}<br><br><span style="font-size:16px; color: white;">Press ENTER to Restart</span>`;
            msgEl.style.display = 'block';
        } else {
            msgEl.style.display = 'none';
        }

        if (state.phase === 'SHOP') {
            this.updateShopUI(state);
        }
    }

    // --- Helpers ---

    private getTank() {
        if (!this._lastState) return null;
        return this._lastState.tanks[this._lastState.currentPlayerIndex];
    }

    private getWeaponIconPath(id: string): string {
        let filename = `${id}.svg`;

        if (id === 'death_head') filename = 'deaths_head.svg';
        else if (id === 'baby_roller' || id === 'roller' || id === 'heavy_roller') filename = 'roller.svg';
        else if (id === 'leapfrog') filename = 'leap_frog.svg';
        else if (id === 'shield') return new URL('../assets/misc/shield.svg', import.meta.url).href;
        else if (id === 'heavy_shield') return new URL('../assets/misc/heavy_shield.svg', import.meta.url).href;
        else if (id === 'heat_guidance') return new URL('../assets/misc/heat_guidance.svg', import.meta.url).href;
        else if (id === 'lazy_boy') return new URL('../assets/misc/lazy_boy.svg', import.meta.url).href;
        else if (id === 'parachute') return new URL('../assets/misc/parachute.svg', import.meta.url).href;
        else if (id === 'fuel_can') return new URL('../assets/misc/fuel_tank.svg', import.meta.url).href;
        else if (id === 'battery') return new URL('../assets/misc/battery.svg', import.meta.url).href;

        return new URL(`../assets/weapons/${filename}`, import.meta.url).href;
    }

    private triggerWeaponSelect(id: string) {
        if (this.onSetWeapon) this.onSetWeapon(id);
    }
    public onSetWeapon: (id: string) => void = () => { };

    private triggerShieldSelect(id: string) {
        if (this.onSetShield) this.onSetShield(id);
    }
    public onSetShield: (id: string) => void = () => { };
    public onSetGuidance: (id: string | null) => void = () => { };
}
// End of UIManager
