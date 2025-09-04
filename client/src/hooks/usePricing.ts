import { useState, useEffect } from 'react';

export interface PricingConfig {
  earlyBirdPrice: number;
  phase1Price: number;
  phase2Price: number;
  convenienceFee: number;
  earlyBirdLimit: number;
  phase1Limit: number;
  phase2Limit: number;
  isEarlyBirdActive: boolean;
  isPhase1Active: boolean;
  isPhase2Active: boolean;
  currentSold: {
    earlyBird: number;
    phase1: number;
    phase2: number;
  };
}

export interface TicketTier {
  id: string;
  name: string;
  price: number;
  available: number;
  total: number;
  active: boolean;
}

// Default configuration
const defaultConfig: PricingConfig = {
  earlyBirdPrice: 300,
  phase1Price: 350,
  phase2Price: 400,
  convenienceFee: 12.96,
  earlyBirdLimit: 90,
  phase1Limit: 200,
  phase2Limit: 210,
  isEarlyBirdActive: true,
  isPhase1Active: false,
  isPhase2Active: false,
  currentSold: {
    earlyBird: 0,
    phase1: 0,
    phase2: 0
  }
};

export const usePricing = () => {
  const [config, setConfig] = useState<PricingConfig>(defaultConfig);

  // Get current active tier based on phase flags and availability
  const getCurrentTier = (): TicketTier | null => {
    // Early Bird has highest priority
    if (config.isEarlyBirdActive && config.currentSold.earlyBird < config.earlyBirdLimit) {
      return {
        id: 'early_bird',
        name: 'Early Bird',
        price: config.earlyBirdPrice,
        available: config.earlyBirdLimit - config.currentSold.earlyBird,
        total: config.earlyBirdLimit,
        active: true
      };
    }

    // Phase 1 has second priority
    if (config.isPhase1Active && config.currentSold.phase1 < config.phase1Limit) {
      return {
        id: 'phase1',
        name: 'Phase 1',
        price: config.phase1Price,
        available: config.phase1Limit - config.currentSold.phase1,
        total: config.phase1Limit,
        active: true
      };
    }

    // Phase 2 has lowest priority
    if (config.isPhase2Active && config.currentSold.phase2 < config.phase2Limit) {
      return {
        id: 'phase2',
        name: 'Phase 2',
        price: config.phase2Price,
        available: config.phase2Limit - config.currentSold.phase2,
        total: config.phase2Limit,
        active: true
      };
    }

    return null; // No tiers available
  };

  // Get all available tiers
  const getAvailableTiers = (): TicketTier[] => {
    const tiers: TicketTier[] = [];

    if (config.isEarlyBirdActive && config.currentSold.earlyBird < config.earlyBirdLimit) {
      tiers.push({
        id: 'early_bird',
        name: 'Early Bird',
        price: config.earlyBirdPrice,
        available: config.earlyBirdLimit - config.currentSold.earlyBird,
        total: config.earlyBirdLimit,
        active: true
      });
    }

    if (config.isPhase1Active && config.currentSold.phase1 < config.phase1Limit) {
      tiers.push({
        id: 'phase1',
        name: 'Phase 1',
        price: config.phase1Price,
        available: config.phase1Limit - config.currentSold.phase1,
        total: config.phase1Limit,
        active: true
      });
    }

    if (config.isPhase2Active && config.currentSold.phase2 < config.phase2Limit) {
      tiers.push({
        id: 'phase2',
        name: 'Phase 2',
        price: config.phase2Price,
        available: config.phase2Limit - config.currentSold.phase2,
        total: config.phase2Limit,
        active: true
      });
    }

    return tiers;
  };

  // Calculate total with convenience fee and discounts
  const calculateTotal = (ticketCount: number, discountPercent: number = 0): number => {
    const currentTier = getCurrentTier();
    if (!currentTier) return 0;

    let subtotal = ticketCount * currentTier.price;
    
    // Apply discount
    if (discountPercent > 0) {
      subtotal -= (subtotal * discountPercent) / 100;
    }
    
    // Add convenience fee per ticket
    const convenienceFees = ticketCount * config.convenienceFee;
    
    return subtotal + convenienceFees;
  };

  // Update configuration (for admin use)
  const updateConfig = (newConfig: Partial<PricingConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  };

  // Toggle phase with mutual exclusivity
  const togglePhase = (phase: 'earlyBird' | 'phase1' | 'phase2', active: boolean) => {
    const newConfig = { ...config };

    if (active) {
      // When activating a phase, deactivate others for mutual exclusivity
      switch (phase) {
        case 'earlyBird':
          newConfig.isEarlyBirdActive = true;
          newConfig.isPhase1Active = false;
          newConfig.isPhase2Active = false;
          break;
        case 'phase1':
          newConfig.isEarlyBirdActive = false;
          newConfig.isPhase1Active = true;
          newConfig.isPhase2Active = false;
          break;
        case 'phase2':
          newConfig.isEarlyBirdActive = false;
          newConfig.isPhase1Active = false;
          newConfig.isPhase2Active = true;
          break;
      }
    } else {
      // When deactivating, just turn off that phase
      switch (phase) {
        case 'earlyBird':
          newConfig.isEarlyBirdActive = false;
          break;
        case 'phase1':
          newConfig.isPhase1Active = false;
          break;
        case 'phase2':
          newConfig.isPhase2Active = false;
          break;
      }
    }

    setConfig(newConfig);
  };

  return {
    config,
    updateConfig,
    togglePhase,
    getCurrentTier,
    getAvailableTiers,
    calculateTotal,
    isLoading: false // Can be extended for API integration
  };
};