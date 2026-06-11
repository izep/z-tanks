import { WEAPONS } from '../core/WeaponData';

export interface MarketState {
    basePrices: Record<string, number>;
    currentPrices: Record<string, number>;
    purchaseCount: Record<string, number>;
    salesCount: Record<string, number>;
    volatility: 'none' | 'low' | 'medium' | 'high';
}

export class EconomySystem {
    private marketState: MarketState;

    constructor(volatility: 'none' | 'low' | 'medium' | 'high' = 'low') {
        this.marketState = {
            basePrices: {},
            currentPrices: {},
            purchaseCount: {},
            salesCount: {},
            volatility
        };

        // Initialize base prices from WeaponData
        for (const weaponId in WEAPONS) {
            const weapon = WEAPONS[weaponId];
            this.marketState.basePrices[weaponId] = weapon.cost;
            this.marketState.currentPrices[weaponId] = weapon.cost;
            this.marketState.purchaseCount[weaponId] = 0;
            this.marketState.salesCount[weaponId] = 0;
        }
    }

    public getPrice(itemId: string): number {
        return Math.round(this.marketState.currentPrices[itemId] || this.marketState.basePrices[itemId] || 0);
    }

    public updatePrice(itemId: string, purchased: boolean): void {
        if (!this.marketState.basePrices[itemId]) return;

        if (purchased) {
            this.marketState.purchaseCount[itemId]++;
            const increase = this.getVolatilityMultiplier();
            this.marketState.currentPrices[itemId] *= (1 + increase);
        } else {
            this.marketState.salesCount[itemId]++;
            const decrease = this.getVolatilityMultiplier();
            this.marketState.currentPrices[itemId] *= (1 - decrease * 0.5);
        }

        // Clamp: 50% to 200% of base price
        const basePrice = this.marketState.basePrices[itemId];
        this.marketState.currentPrices[itemId] = Math.max(
            basePrice * 0.5,
            Math.min(basePrice * 2.0, this.marketState.currentPrices[itemId])
        );
    }

    private getVolatilityMultiplier(): number {
        switch (this.marketState.volatility) {
            case 'none': return 0;
            case 'low': return 0.05;
            case 'medium': return 0.10;
            case 'high': return 0.20;
        }
    }

    public applyMarketForces(): void {
        for (const itemId in this.marketState.currentPrices) {
            const current = this.marketState.currentPrices[itemId];
            const base = this.marketState.basePrices[itemId];
            const drift = 0.02; // 2% drift toward base per round
            this.marketState.currentPrices[itemId] = current + (base - current) * drift;
        }
    }

    public setVolatility(volatility: 'none' | 'low' | 'medium' | 'high'): void {
        this.marketState.volatility = volatility;
    }

    public getMarketState(): Readonly<MarketState> {
        return this.marketState;
    }

    /** Restores market state from a saved game. */
    public restoreMarketState(saved: MarketState): void {
        // Keep base prices authoritative from WeaponData; restore dynamics
        this.marketState.volatility = saved.volatility;
        for (const itemId in this.marketState.basePrices) {
            if (saved.currentPrices[itemId] !== undefined) {
                this.marketState.currentPrices[itemId] = saved.currentPrices[itemId];
            }
            this.marketState.purchaseCount[itemId] = saved.purchaseCount[itemId] || 0;
            this.marketState.salesCount[itemId] = saved.salesCount[itemId] || 0;
        }
    }
}
