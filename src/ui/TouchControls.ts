import { InputManager, GameAction } from '../core/InputManager';

export class TouchControls {
    private inputManager: InputManager;

    constructor(inputManager: InputManager) {
        this.inputManager = inputManager;

        // Detect touch device or just always enable if buttons exist
        // We always try to attach listeners to the buttons if they are found
        this.attachListeners();

        // If we want to hide/show something based on touch, we can do it here,
        // but currently the buttons are part of the main UI.
    }

    private attachListeners() {
        this.bindButton('btn-up', GameAction.POWER_UP);
        this.bindButton('btn-down', GameAction.POWER_DOWN);
        this.bindButton('btn-left', GameAction.AIM_UP); // ArrowLeft maps to AIM_UP in InputManager default
        this.bindButton('btn-right', GameAction.AIM_DOWN); // ArrowRight maps to AIM_DOWN
        this.bindButton('btn-fire', GameAction.FIRE);
        this.bindButton('btn-fire-small', GameAction.FIRE);
        this.bindButton('btn-move-left', GameAction.MOVE_LEFT);
        this.bindButton('btn-move-right', GameAction.MOVE_RIGHT);
        this.bindButton('btn-battery', GameAction.USE_BATTERY);
    }

    private bindButton(id: string, action: GameAction) {
        const btn = document.getElementById(id);
        if (!btn) return;

        const start = (e: Event) => {
            e.preventDefault();
            this.inputManager.setInternalState(action, true);
            btn.style.opacity = '1.0';
            btn.style.transform = 'scale(0.95)';
        };

        const end = (e: Event) => {
            e.preventDefault();
            this.inputManager.setInternalState(action, false);
            btn.style.opacity = '0.7'; // Reset opacity
            btn.style.transform = 'scale(1.0)';
        };

        btn.addEventListener('mousedown', start);
        btn.addEventListener('touchstart', start, { passive: false });

        btn.addEventListener('mouseup', end);
        btn.addEventListener('mouseleave', end);
        btn.addEventListener('touchend', end);
        btn.addEventListener('touchcancel', end);
    }
}
