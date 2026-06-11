import { type GameState, GamePhase, CONSTANTS, ECONOMY, PLAY_PHASES } from './GameState';
import { InputManager, GameAction } from './InputManager';
import { TerrainSystem } from '../systems/TerrainSystem';
import { PhysicsSystem, resetIdCounter } from '../systems/PhysicsSystem';
import { UIManager } from '../ui/UIManager';
import { SoundManager } from './SoundManager';
import { RenderSystem } from '../systems/RenderSystem';
import { GameSetupSystem } from '../systems/GameSetupSystem';
import { PlayerInputSystem } from '../systems/PlayerInputSystem';
import { AISystem } from '../systems/AISystem';
import { ShopSystem } from '../systems/ShopSystem';
import { GameFlowSystem } from '../systems/GameFlowSystem';
import { EconomySystem } from '../systems/EconomySystem';
import { SaveSystem } from '../systems/SaveSystem';
import { 
    DefaultBorderStrategy, 
    WrapBorderStrategy, 
    BounceBorderStrategy, 
    ConcreteBorderStrategy 
} from '../systems/physics/BorderStrategy';

export class GameEngine {
    private canvas: HTMLCanvasElement;
    // private ctx: CanvasRenderingContext2D; // Moved to RenderSystem
    private isRunning: boolean = false;
    private lastTime: number = 0;
    private boundGameLoop: (ts: number) => void;

    public state: GameState;
    public inputManager: InputManager;
    public terrainSystem: TerrainSystem;
    public physicsSystem: PhysicsSystem;
    public uiManager: UIManager;
    public soundManager: SoundManager;
    public renderSystem: RenderSystem;
    public gameSetupSystem: GameSetupSystem;
    public playerInputSystem: PlayerInputSystem;
    public aiSystem: AISystem;
    public shopSystem: ShopSystem;
    public gameFlowSystem: GameFlowSystem;
    public economySystem: EconomySystem;
    public saveSystem: SaveSystem;
    private lastSavePhase: GamePhase | null = null;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.boundGameLoop = this.gameLoop.bind(this);
        // this.ctx = canvas.getContext('2d')!;
        this.inputManager = new InputManager();

        // Initialize State
        this.state = {
            phase: GamePhase.MENU,
            tanks: [],
            projectiles: [],
            explosions: [],
            smokeTrails: [],
            currentPlayerIndex: 0,
            roundNumber: 1,
            maxRounds: 10,
            wind: 0,
            gravity: CONSTANTS.GRAVITY,
            terrainDirty: false,
            lastExplosionTime: 0
        };

        // Setup Canvas
        this.canvas.width = CONSTANTS.SCREEN_WIDTH;
        this.canvas.height = CONSTANTS.SCREEN_HEIGHT;

        // Systems
        this.terrainSystem = new TerrainSystem(CONSTANTS.SCREEN_WIDTH, CONSTANTS.SCREEN_HEIGHT);
        this.uiManager = new UIManager();
        this.soundManager = new SoundManager();
        this.physicsSystem = new PhysicsSystem(this.terrainSystem, this.soundManager);
        this.renderSystem = new RenderSystem(this.canvas, this.terrainSystem);
        this.gameSetupSystem = new GameSetupSystem(this.terrainSystem, this.soundManager);
        this.playerInputSystem = new PlayerInputSystem(
            this.inputManager,
            this.terrainSystem,
            this.physicsSystem,
            this.soundManager
        );
        this.aiSystem = new AISystem(this.physicsSystem, this.soundManager, this.terrainSystem);
        this.economySystem = new EconomySystem('low');
        this.saveSystem = new SaveSystem();
        this.shopSystem = new ShopSystem(this.soundManager, this.economySystem);
        this.gameFlowSystem = new GameFlowSystem(this.terrainSystem, this.physicsSystem, this.soundManager);

        // Init Terrain - Moved to initialize()
        // this.terrainSystem.generate(this.state);

        // UI Bindings
        this.uiManager.onBuyWeapon = (weaponId) => this.shopSystem.handleBuyWeapon(this.state, weaponId);
        this.uiManager.onSellWeapon = (weaponId) => this.shopSystem.handleSellWeapon(this.state, weaponId);
        this.uiManager.getPrice = (weaponId) => this.economySystem.getPrice(weaponId);
        this.uiManager.onNextRound = async () => {
            if (this.shopSystem.tryNextShopTurn(this.state)) {
                this.soundManager.playUI();
            } else {
                await this.gameFlowSystem.handleNextRound(this.state);
            }
        };
        this.uiManager.onStartGame = async (config) => {
            resetIdCounter(); // Fresh IDs for each new game session
            await this.gameSetupSystem.handleStartGame(this.state, config);
            this.applyBorderMode(config.borders);
            this.economySystem.setVolatility(config.volatility || 'low');
            this.soundManager.startMusic();
        };
        this.uiManager.getAudioSettings = () => this.soundManager.getSettings();
        this.uiManager.onAudioChange = (s) => {
            if (s.volume !== undefined) this.soundManager.setVolume(s.volume);
            if (s.muted !== undefined) this.soundManager.setMuted(s.muted);
            if (s.music !== undefined) this.soundManager.setMusicEnabled(s.music);
        };
        this.uiManager.hasSavedGame = () => this.saveSystem.hasSave();
        this.uiManager.onContinueGame = async () => {
            const ok = await this.saveSystem.load(this.state, this.terrainSystem, this.economySystem);
            if (ok) {
                this.applyBorderMode(this.state.borderMode || 'normal');
                this.lastSavePhase = this.state.phase;
                this.soundManager.playUI();
                this.soundManager.startMusic();
            } else {
                console.warn('Could not load saved game');
            }
        };
        this.uiManager.onSetWeapon = (id) => this.shopSystem.handleSetWeapon(this.state, id);
        this.uiManager.onSetShield = (id) => this.shopSystem.handleSetShield(this.state, id);
        this.uiManager.onSetGuidance = (id) => {
            const tank = this.state.tanks[this.state.currentPlayerIndex];
            if (!tank) return;
            if (id === null) {
                tank.activeGuidance = undefined;
            } else if ((tank.accessories[id] || 0) > 0) {
                tank.activeGuidance = id;
            }
            this.soundManager.playUI();
        };
        this.uiManager.onRestartGame = () => {
            this.state.phase = GamePhase.MENU;
            this.soundManager.playUI();
        };
        this.uiManager.onNewGame = () => {
            this.state.phase = GamePhase.SETUP;
            this.soundManager.playUI();
        };
        this.uiManager.onTogglePause = () => {
            if (!PLAY_PHASES.includes(this.state.phase)) return;
            this.state.isPaused = !this.state.isPaused;
            this.soundManager.playUI();
        };
        this.uiManager.onQuitToMenu = () => {
            // Best effort: persists when the game is in a stable phase;
            // otherwise the turn-start autosave already covers it
            this.saveSystem.save(this.state, this.terrainSystem, this.economySystem);
            this.state.isPaused = false;
            this.state.phase = GamePhase.MENU;
            this.soundManager.playUI();
        };

        // Wire Input
        this.uiManager.onAction = (actionName, active) => {
            // Map string to GameAction
            const action = GameAction[actionName as keyof typeof GameAction];
            if (action) {
                this.inputManager.handleInput(action, active);
            }
        };
    }

    public async initialize() {
        await this.terrainSystem.init();
        await this.terrainSystem.generate(this.state);
    }

    public start() {
        this.isRunning = true;
        this.lastTime = performance.now();
        requestAnimationFrame(this.boundGameLoop);
    }

    private gameLoop(timestamp: number) {
        if (!this.isRunning) return;

        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        this.update(dt);
        this.render();

        requestAnimationFrame(this.boundGameLoop);
    }

    private update(dt: number) {
        // Paused: freeze the simulation entirely (rendering continues)
        if (this.state.isPaused) return;

        // 1. Process Input
        if (this.state.phase === GamePhase.AIMING) {
            const currentTank = this.state.tanks[this.state.currentPlayerIndex];
            if (currentTank) {
                if (currentTank.isAi) {
                    this.aiSystem.handleAiTurn(this.state, dt);
                } else {
                    this.playerInputSystem.handleAimingInput(this.state, dt);
                }
            } else {
                // Tank dead? Next turn?
                // Should be handled by logic check, but let's ensure next turn triggers if undefined
                // This might happen if index is invalid
            }
        }

        // 2. Update Systems (Physics, Terrain)
        this.physicsSystem.update(this.state, dt);

        // 3. Terrain Settling
        if (this.state.phase === GamePhase.TERRAIN_SETTLING || this.state.terrainDirty) {
            try {
                const moved = this.terrainSystem.settle(this.state);
                
                // Clear dirty flag if settling is complete
                if (!moved) {
                    this.state.terrainDirty = false;
                }
                
                // Only handle phase transition if we're in TERRAIN_SETTLING phase
                if (!moved && this.state.phase === GamePhase.TERRAIN_SETTLING) {
                    // Settling done — check win condition before advancing turn

                    // Check Win Condition before next turn
                    const alive = this.state.tanks.filter(t => !t.isDead && t.health > 0);
                    if (alive.length <= 1) {
                        // Round Over
                        if (alive.length === 1) {
                            const winner = alive[0];
                            winner.credits += ECONOMY.ROUND_WIN_BONUS;
                        }

                        if (this.state.roundNumber >= this.state.maxRounds) {
                            this.state.phase = GamePhase.GAME_OVER;
                            this.soundManager.playUI();
                        } else {
                            // Unspent credits accrue interest between rounds for living tanks (Requirements 3.2)
                            const interestRate = this.state.interestRate ?? ECONOMY.INTEREST_RATE;
                            this.state.tanks.forEach(t => {
                                if (!t.isDead && t.health > 0) {
                                    t.credits = Math.floor(t.credits * (1 + interestRate));
                                }
                            });
                            this.state.phase = GamePhase.SHOP;
                            this.shopSystem.applyMarketForces(); // Apply market drift
                            this.handleAiShopping();
                            this.shopSystem.initShopTurn(this.state);
                        }
                    } else {
                        this.physicsSystem.nextTurn(this.state);
                    }
                }
            } catch (e) {
                console.error('Terrain settling error:', e);
                this.state.terrainDirty = false;
            }
        }
        this.gameFlowSystem.update(this.state);
        // Shop phase input (Enter to continue) is handled by UIManager's key listener.

        // Autosave on entering a stable phase; clear the save once the game ends
        if (this.state.phase !== this.lastSavePhase) {
            this.lastSavePhase = this.state.phase;
            if (this.state.phase === GamePhase.AIMING || this.state.phase === GamePhase.SHOP) {
                this.saveSystem.save(this.state, this.terrainSystem, this.economySystem);
            } else if (this.state.phase === GamePhase.GAME_OVER) {
                this.saveSystem.clear();
            }
        }
    }

    private applyBorderMode(mode?: string) {
        switch (mode) {
            case 'wrap':
                this.physicsSystem.setBorderStrategy(new WrapBorderStrategy());
                break;
            case 'bounce':
                this.physicsSystem.setBorderStrategy(new BounceBorderStrategy());
                break;
            case 'concrete':
                this.physicsSystem.setBorderStrategy(new ConcreteBorderStrategy());
                break;
            default:
                this.physicsSystem.setBorderStrategy(new DefaultBorderStrategy());
                break;
        }
    }

    private render() {
        this.renderSystem.render(this.state);
        this.uiManager.update(this.state);
    }

    private handleAiShopping() {
        this.state.tanks.forEach(tank => {
            if (tank.isAi && tank.aiController) {
                const purchases = tank.aiController.makePurchases(tank);
                for (const itemId in purchases) {
                    const quantity = purchases[itemId];
                    for (let i = 0; i < quantity; i++) {
                        this.shopSystem.handleBuyWeapon(this.state, itemId, tank.id);
                    }
                }
            }
        });
    }
}
