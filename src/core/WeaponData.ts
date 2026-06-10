export interface WeaponStats {
    name: string;
    cost: number;
    radius: number;
    damage: number; // Max damage
    color: string;
    description: string;
    bundleSize: number; // How many items per purchase
    // Special properties
    type?: 'missile' | 'mirv' | 'nuke' | 'dirt' | 'roller' | 'digger' | 'napalm' | 'item' | 'bouncer' | 'riot_charge' | 'sandhog' | 'dirt_destroyer' | 'liquid_dirt' | 'dirt_charge' | 'earth_disrupter' | 'plasma' | 'laser' | 'tracer' | 'smoke_tracer';
    effectValue?: number; // e.g., fuel amount, shield count
    shieldStrength?: number; // Hit points when this shield is activated
    trailColor?: string; // For smoke tracer
    trailDuration?: number; // For smoke tracer (ms)
}

/**
 * Activates a shield from the tank's accessories, consuming one unit.
 * Without a preferredId, picks the strongest shield available.
 * Returns false if no shield of the requested type is owned.
 */
export function activateShield(
    tank: { accessories: Record<string, number>; activeShield?: string; shieldHealth?: number },
    preferredId?: string
): boolean {
    const id = preferredId ?? ((tank.accessories['heavy_shield'] || 0) > 0 ? 'heavy_shield' : 'shield');
    if ((tank.accessories[id] || 0) <= 0) return false;
    tank.accessories[id]--;
    tank.activeShield = id;
    tank.shieldHealth = WEAPONS[id]?.shieldStrength || 200;
    return true;
}

export const WEAPON_ORDER = [
    'baby_missile',
    'missile',
    'baby_nuke',
    'nuke',
    'mirv',
    'death_head',
    'funky_bomb',
    'leapfrog',
    // Earth Destroying
    'riot_charge',
    'riot_blast',
    'riot_bomb',
    'heavy_riot_bomb',
    'baby_digger',
    'digger',
    'heavy_digger',
    'baby_sandhog',
    'sandhog',
    'heavy_sandhog',
    // Earth Producing
    'dirt_clod',
    'dirt_ball',
    'ton_of_dirt',
    'liquid_dirt',
    'dirt_charge',
    'earth_disrupter',
    // Energy Weapons
    'plasma_blast',
    'laser',
    // Other
    'napalm',
    'hot_napalm',
    'baby_roller',
    'roller',
    'heavy_roller',
    // Utility
    'tracer',
    'smoke_tracer',
    // Items
    'fuel_can',
    'shield',
    'heavy_shield',
    'parachute',
    'battery',
    'heat_guidance',
    'lazy_boy',
];

/** Guidance accessories, strongest first (Requirements 2.2). */
export const GUIDANCE_ORDER = ['lazy_boy', 'heat_guidance'];

export const WEAPONS: Record<string, WeaponStats> = {
    'baby_missile': {
        name: 'Baby Missile',
        cost: 400,
        radius: 10,
        damage: 50,
        color: '#FFFFFF',
        description: 'Standard issue. Weak but infinite.',
        bundleSize: 10
    },
    'missile': {
        name: 'Missile',
        cost: 1875,
        radius: 20,
        damage: 100,
        color: '#FFCC00',
        description: 'Standard explosive.',
        bundleSize: 5
    },
    'nuke': {
        name: 'Nuke',
        cost: 12000,
        radius: 75,
        damage: 500,
        color: '#FF4400',
        description: 'Huge explosion. Dangerous.',
        bundleSize: 1
    },
    'mirv': {
        name: 'MIRV',
        cost: 10000,
        radius: 20,
        damage: 80,
        color: '#FF00FF',
        description: 'Splits into 5 missile warheads at apogee. Fizzles if it hits first.',
        type: 'mirv',
        bundleSize: 3
    },
    'dirt_clod': {
        name: 'Dirt Clod',
        cost: 5000,
        radius: 20,
        damage: 0,
        color: '#A0522D',
        description: 'Explodes into a sphere of dirt.',
        type: 'dirt',
        bundleSize: 10
    },
    'dirt_ball': {
        name: 'Dirt Ball',
        cost: 5000,
        radius: 35,
        damage: 0,
        color: '#8B4513',
        description: 'A larger form of Dirt Clod.',
        type: 'dirt',
        bundleSize: 5
    },
    'ton_of_dirt': {
        name: 'Ton of Dirt',
        cost: 6750,
        radius: 70,
        damage: 0,
        color: '#5C4033',
        description: 'A very large Dirt Ball.',
        type: 'dirt',
        bundleSize: 2
    },
    'liquid_dirt': {
        name: 'Liquid Dirt',
        cost: 5000,
        radius: 0,
        damage: 0,
        color: '#E6D2B5',
        description: 'Oozes out where it lands, filling holes.',
        type: 'liquid_dirt',
        bundleSize: 10
    },
    'dirt_charge': {
        name: 'Dirt Charge',
        cost: 5000,
        radius: 0,
        damage: 0,
        color: '#9B7653',
        description: 'Expels a cloud of dirt in a wedge shape.',
        type: 'dirt_charge',
        bundleSize: 5
    },
    'earth_disrupter': {
        name: 'Earth Disrupter',
        cost: 5000,
        radius: 0,
        damage: 0,
        color: '#000000',
        description: 'Forces all suspended dirt to settle.',
        type: 'earth_disrupter',
        bundleSize: 10
    },
    'plasma_blast': {
        name: 'Plasma Blast',
        cost: 9000,
        radius: 75,
        damage: 200,
        color: '#00FFFF',
        description: 'Expels radioactive energy from your tank.',
        type: 'plasma',
        bundleSize: 5
    },
    'laser': {
        name: 'Laser',
        cost: 5000,
        radius: 0,
        damage: 150,
        color: '#FF0000',
        description: 'Shoots a high-intensity beam of light.',
        type: 'laser',
        bundleSize: 5
    },
    'funky_bomb': {
        name: 'Funky Bomb',
        cost: 7000,
        radius: 80,
        damage: 150,
        color: '#00FF00',
        description: 'Multi-colored toxic chain reaction.',
        bundleSize: 2
    },
    'baby_roller': {
        name: 'Baby Roller',
        cost: 5000,
        radius: 10,
        damage: 50,
        color: '#00CCCC',
        description: 'Small roller, bounces downhill.',
        type: 'roller',
        bundleSize: 10
    },
    'roller': {
        name: 'Roller',
        cost: 6000,
        radius: 20,
        damage: 100,
        color: '#00FFFF',
        description: 'Rolls along the ground.',
        type: 'roller',
        bundleSize: 5
    },
    'baby_nuke': {
        name: 'Baby Nuke',
        cost: 10000,
        radius: 40,
        damage: 200,
        color: '#FF6600',
        description: 'Smaller nuke.',
        bundleSize: 3
    },
    'death_head': {
        name: "Death's Head",
        cost: 20000,
        radius: 35,
        damage: 200,
        color: '#440000',
        description: 'Splits into 9 nuclear warheads at apogee. The ultimate weapon.',
        type: 'mirv',
        bundleSize: 1
    },
    'digger': {
        name: 'Digger',
        cost: 2500,
        radius: 0,
        damage: 0,
        color: '#888888',
        description: 'Digs a tunnel through terrain.',
        type: 'digger',
        bundleSize: 5
    },
    'napalm': {
        name: 'Napalm',
        cost: 10000,
        radius: 60,
        damage: 40, // Low direct damage, burns terrain
        color: '#FF2200',
        description: 'Burns terrain and tanks.',
        type: 'napalm',
        bundleSize: 10
    },
    'hot_napalm': {
        name: 'Hot Napalm',
        cost: 20000,
        radius: 90,
        damage: 80,
        color: '#FF8800',
        description: 'More intense burn.',
        type: 'napalm',
        bundleSize: 2
    },
    'riot_charge': {
        name: 'Riot Charge',
        cost: 2000,
        radius: 36,
        damage: 0,
        color: '#D3D3D3',
        description: 'Destroys a wedge-shaped section of dirt from your turret.',
        type: 'riot_charge',
        bundleSize: 10
    },
    'riot_blast': {
        name: 'Riot Blast',
        cost: 5000,
        radius: 60,
        damage: 0,
        color: '#A9A9A9',
        description: 'A larger version of the Riot Charge.',
        type: 'riot_charge',
        bundleSize: 5
    },
    'heavy_riot_bomb': {
        name: 'Heavy Riot Bomb',
        cost: 4750,
        radius: 45,
        damage: 0,
        color: '#E0E0E0',
        description: 'A scaled up version of Riot Bomb.',
        type: 'dirt_destroyer',
        bundleSize: 2
    },
    'baby_digger': {
        name: 'Baby Digger',
        cost: 3000,
        radius: 0,
        damage: 0,
        color: '#C0C0C0',
        description: 'Tunnels through terrain when it hits.',
        type: 'digger',
        bundleSize: 10
    },
    'heavy_digger': {
        name: 'Heavy Digger',
        cost: 6750,
        radius: 0,
        damage: 0,
        color: '#696969',
        description: 'The largest Digger-weapon available.',
        type: 'digger',
        bundleSize: 2
    },
    'baby_sandhog': {
        name: 'Baby Sandhog',
        cost: 10000,
        radius: 0,
        damage: 50,
        color: '#DAA520',
        description: 'Tunnels and contains a small explosive charge.',
        type: 'sandhog',
        bundleSize: 10
    },
    'sandhog': {
        name: 'Sandhog',
        cost: 16750,
        radius: 0,
        damage: 80,
        color: '#B8860B',
        description: 'Contains more warheads than the Baby Sandhog.',
        type: 'sandhog',
        bundleSize: 5
    },
    'heavy_sandhog': {
        name: 'Heavy Sandhog',
        cost: 25000,
        radius: 0,
        damage: 150,
        color: '#808000',
        description: 'Can potentially destroy the world.',
        type: 'sandhog',
        bundleSize: 2
    },
    'riot_bomb': {
        name: 'Riot Bomb',
        cost: 5000,
        radius: 30,
        damage: 0, // No damage
        color: '#FFFFFF',
        description: 'Destroys a spherical section of dirt.',
        type: 'dirt_destroyer',
        bundleSize: 5
    },
    'heavy_roller': {
        name: 'Heavy Roller',
        cost: 6750,
        radius: 45,
        damage: 200,
        color: '#008888',
        description: 'A bigger, heavier roller.',
        type: 'roller',
        bundleSize: 2
    },
    'leapfrog': {
        name: 'LeapFrog',
        cost: 10000,
        radius: 30,
        damage: 80,
        color: '#00AA00',
        description: 'Fires 3 sequential warheads, each launching after the previous explodes.',
        type: 'bouncer',
        bundleSize: 2
    },
    'fuel_can': {
        name: 'Fuel (250)',
        cost: 10000,
        radius: 0,
        damage: 0,
        color: '#884400',
        description: 'Restores fuel.',
        type: 'item',
        effectValue: 250,
        bundleSize: 1
    },
    'shield': {
        name: 'Shield',
        cost: 20000,
        radius: 0,
        damage: 0,
        color: '#00FFFF',
        description: 'Energy shield. Absorbs 200 damage.',
        type: 'item',
        effectValue: 1,
        shieldStrength: 200,
        bundleSize: 1
    },
    'heavy_shield': {
        name: 'Heavy Shield',
        cost: 30000,
        radius: 0,
        damage: 0,
        color: '#0088FF',
        description: 'Reinforced shield. Absorbs 400 damage.',
        type: 'item',
        effectValue: 1,
        shieldStrength: 400,
        bundleSize: 1
    },
    'parachute': {
        name: 'Parachute',
        cost: 10000,
        radius: 0,
        damage: 0,
        color: '#FFFFFF',
        description: 'Saves you from falls.',
        type: 'item',
        effectValue: 1,
        bundleSize: 1
    },
    'battery': {
        name: 'Battery',
        cost: 5000,
        radius: 0,
        damage: 0,
        color: '#FFFF00',
        description: 'Restores 10 health, raising max firing power. Boosts energy weapons.',
        type: 'item',
        effectValue: 10,
        bundleSize: 1
    },
    'heat_guidance': {
        name: 'Heat Guidance',
        cost: 6000,
        radius: 0,
        damage: 0,
        color: '#FF8866',
        description: 'Steers your shot toward the nearest enemy as it descends. One per shot.',
        type: 'item',
        effectValue: 1,
        bundleSize: 1
    },
    'lazy_boy': {
        name: 'Lazy Boy',
        cost: 19000,
        radius: 0,
        damage: 0,
        color: '#FF44AA',
        description: 'Full-flight homing guidance. Fire and forget. One per shot.',
        type: 'item',
        effectValue: 1,
        bundleSize: 1
    },
    'tracer': {
        name: 'Tracer',
        cost: 10,
        radius: 0,
        damage: 0,
        color: '#FFFF00',
        description: 'Shows trajectory, no damage.',
        type: 'tracer',
        bundleSize: 20
    },
    'smoke_tracer': {
        name: 'Smoke Tracer',
        cost: 500,
        radius: 0,
        damage: 0,
        color: '#00FF00',
        description: 'Trajectory with colored smoke trail.',
        type: 'smoke_tracer',
        bundleSize: 10,
        trailColor: '#00FF00',
        trailDuration: 4000
    }
};
