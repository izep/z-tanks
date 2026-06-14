import './style.css'
import { GameEngine } from './core/GameEngine';
import { TouchControls } from './ui/TouchControls';
import { library, dom } from "@fortawesome/fontawesome-svg-core";
import { faGear, faBolt, faBomb, faHeart, faShieldAlt, faCoins, faWind, faCrosshairs } from "@fortawesome/free-solid-svg-icons";
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker
registerSW({
  onNeedRefresh() {
    // Show a prompt to user? For now, just auto-reload or ignore
    // updateSW(true);
    console.log("New content available, reload to update.");
  },
  onOfflineReady() {
    console.log("App is ready for offline use.");
  },
});

// Add icons to the library
library.add(faGear, faBolt, faBomb, faHeart, faShieldAlt, faCoins, faWind, faCrosshairs);

// Automatically replace <i> tags with <svg>
dom.watch();

const init = () => {
  let app = document.querySelector<HTMLDivElement>('#app');
  if (!app) {
    console.warn("Element '#app' not found in DOM. Current body:", document.body.innerHTML);
    app = document.createElement('div');
    app.id = 'app';
    document.body.appendChild(app);
  }

  app.innerHTML = `
    <div id="game-container">
      <canvas id="game-canvas"></canvas>
      <div id="ui-layer"></div>
    </div>
  `;

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const engine = new GameEngine(canvas);
  (window as any).game = engine; // Expose for testing/debugging

  engine.initialize().then(() => {
    engine.start();
  });

  new TouchControls(engine.inputManager);

  // iOS requires AudioContext to be resumed inside a user gesture.
  // Register a one-shot capture listener so it fires before any other handler.
  const unlockAudio = () => {
    engine.soundManager.resume();
    document.removeEventListener('touchstart', unlockAudio, true);
    document.removeEventListener('mousedown', unlockAudio, true);
  };
  document.addEventListener('touchstart', unlockAudio, { capture: true, passive: true });
  document.addEventListener('mousedown', unlockAudio, { capture: true });

  console.log("Game Started");
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
