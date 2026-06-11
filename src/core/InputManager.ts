export const GameAction = {
    AIM_UP: 'AIM_UP',
    AIM_DOWN: 'AIM_DOWN',
    POWER_UP: 'POWER_UP',
    POWER_DOWN: 'POWER_DOWN',
    FIRE: 'FIRE',
    NEXT_WEAPON: 'NEXT_WEAPON',
    PREV_WEAPON: 'PREV_WEAPON',
    MOVE_LEFT: 'MOVE_LEFT',
    MOVE_RIGHT: 'MOVE_RIGHT',
    TOGGLE_SHIELD: 'TOGGLE_SHIELD',
    USE_BATTERY: 'USE_BATTERY',
    TOGGLE_TRIGGER: 'TOGGLE_TRIGGER',
} as const;

export type GameAction = typeof GameAction[keyof typeof GameAction];


export class InputManager {
    private activeActions: Set<GameAction> = new Set();
    private triggeredActions: Set<GameAction> = new Set();
    private keysHeld: Set<string> = new Set();
    private keyBindings: Map<string, GameAction> = new Map();

    constructor() {
        this.setupDefaultBindings();
        this.attachListeners();
    }

    private setupDefaultBindings() {
        this.keyBindings.set('ArrowLeft', GameAction.AIM_UP);
        this.keyBindings.set('ArrowRight', GameAction.AIM_DOWN);
        this.keyBindings.set('ArrowUp', GameAction.POWER_UP);
        this.keyBindings.set('ArrowDown', GameAction.POWER_DOWN);

        this.keyBindings.set(' ', GameAction.FIRE);
        this.keyBindings.set('Tab', GameAction.NEXT_WEAPON);
        this.keyBindings.set('s', GameAction.TOGGLE_SHIELD);

        // Movement keys
        this.keyBindings.set('a', GameAction.MOVE_LEFT);
        this.keyBindings.set('d', GameAction.MOVE_RIGHT);

        // Battery key
        this.keyBindings.set('b', GameAction.USE_BATTERY);

        // Contact trigger key
        this.keyBindings.set('t', GameAction.TOGGLE_TRIGGER);
    }

    private attachListeners() {
        window.addEventListener('keydown', (e) => {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
                return;
            }

            this.keysHeld.add(e.key);
            const action = this.keyBindings.get(e.key);
            if (action !== undefined) {
                e.preventDefault();
                this.activeActions.add(action);
                this.triggeredActions.add(action);
            }
        });

        window.addEventListener('keyup', (e) => {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
                this.keysHeld.delete(e.key);
                return;
            }

            this.keysHeld.delete(e.key);
            const action = this.keyBindings.get(e.key);
            if (action !== undefined) {
                e.preventDefault();
                this.activeActions.delete(action);
            }
        });

        // Clear all held inputs when window loses focus to prevent phantom stuck keys
        window.addEventListener('blur', () => {
            this.activeActions.clear();
            this.keysHeld.clear();
        });
    }

    public isActionActive(action: GameAction): boolean {
        return this.activeActions.has(action);
    }

    public isActionTriggered(action: GameAction): boolean {
        const triggered = this.triggeredActions.has(action);
        if (triggered) {
            this.triggeredActions.delete(action);
        }
        return triggered;
    }

    // Call this start of frame to handle "pressed this frame" vs "held" if needed
    // For now simple boolean check is fine for continuous input

    public setInternalState(action: GameAction, active: boolean) {
        if (active) {
            this.activeActions.add(action);
            this.triggeredActions.add(action);
        } else {
            this.activeActions.delete(action);
        }
    }

    public handleInput(action: GameAction, active: boolean) {
        this.setInternalState(action, active);
    }
}
