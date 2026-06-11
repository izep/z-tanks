import type { GameState, TankState } from './GameState';

/**
 * Talking Tanks (Requirements 3.4 / 6.2): humorous one-liners shown in a
 * speech bubble. Disabled via the "Talking Tanks" setup option.
 */
export const TANK_TALK = {
    fire: [
        'Eat this!', 'Take cover!', 'Incoming!', 'Bye bye!',
        'Special delivery!', 'Think fast!', 'Catch!', 'Going up!',
        'This one has your name on it!', 'Knock knock!',
        'Air mail!', 'Duck and cover!'
    ],
    aiFire: [
        'Calculating...', 'Target Acquired', 'Exterminate!', 'Logic demands death',
        'Probability of your survival: low', 'Executing fire solution',
        'Resistance is pointless', 'You are an inefficiency',
        'Trajectory locked', 'Goodbye, meatbag', 'Optimal solution found',
        'This will only hurt a lot'
    ],
    death: [
        'Ouch!', 'Nooo!', 'Darn!', 'Avenge me!',
        'Tell my tread I loved her...', 'I regret nothing!',
        'So this is how it ends', 'Worth it!', 'I needed a wash anyway',
        "I'm melting!", 'See you in the shop...', 'Critical existence failure'
    ]
};

export type TalkPool = keyof typeof TANK_TALK;

/**
 * Makes a tank say a random line from a pool, honoring the Talking Tanks
 * setting. `chance` is the probability of speaking at all (1 = always).
 */
export function tankSay(state: GameState, tank: TankState, pool: TalkPool, chance: number = 1, duration: number = 2): void {
    if (state.talkingTanks === false) return;
    if (Math.random() > chance) return;
    const phrases = TANK_TALK[pool];
    tank.lastWords = phrases[Math.floor(Math.random() * phrases.length)];
    tank.sayTimer = duration;
}
