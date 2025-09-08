import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface PricingTier {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  isActive: boolean;
  capacity: number;
  soldCount: number;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export interface PricingConfig {
  earlyBird: PricingTier;
  phase1: PricingTier;
  phase2: PricingTier;
  phase4: PricingTier;
  convenienceFee: number;
  currency: string;
  lastUpdated: string;
}

export interface PricingContextType {
  config: PricingConfig | null;
  currentTier: PricingTier | null;
  isLoading: boolean;
  error: string | null;
  refreshPricing: () => Promise<void>;
  formatCurrency: (amount: number) => string;
  calculateTotal: (ticketCount: number, couponDiscount?: number) => {
    subtotal: number;
    discount: number;
    convenienceFee: number;
    total: number;
  };
  getAvailableTiers: () => PricingTier[];
  getCurrentTier: () => PricingTier | null;
}

const PRICING_CACHE_TIME = 30000; // 30 seconds
const PRICING_STALE_TIME = 10000; // 10 seconds

export function usePricing(): PricingContextType {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch pricing configuration with real-time updates
  const { 
    data: config, 
    isLoading, 
    refetch: refetchConfig,
    error: queryError 
  } = useQuery({
    queryKey: ['pricing-config'],
    queryFn: async () => {
      const [configResponse, countsResponse] = await Promise.all([
        fetch('/api/ticket-config'),
        fetch('/api/ticket-counts')
      ]);

      if (!configResponse.ok || !countsResponse.ok) {
        throw new Error('Failed to fetch pricing data');
      }

      const configData = await configResponse.json();
      const countsData = await countsResponse.json();

      // Transform the data into our standardized format
      const pricingConfig: PricingConfig = {
        earlyBird: {
          id: 'early_bird',
          name: 'Early Bird',
          price: parseInt(configData.config?.earlyBirdPrice) || 300,
          isActive: configData.config?.isEarlyBirdActive || false,
          capacity: configData.config?.earlyBirdLimit || 90,
          soldCount: countsData.earlyBirdCount || 0,
          description: 'Limited time offer - Get your tickets at the best price!'
        },
        phase1: {
          id: 'phase_1',
          name: 'Phase 1',
          price: parseInt(configData.config?.phase1Price) || 350,
          isActive: configData.config?.isPhase1Active || false,
          capacity: configData.config?.phase1Limit || 200,
          soldCount: countsData.phase1Count || 0,
          description: 'Regular pricing with guaranteed entry'
        },
        phase2: {
          id: 'phase_2',
          name: 'Phase 2',
          price: parseInt(configData.config?.phase2Price) || 400,
          isActive: configData.config?.isPhase2Active || false,
          capacity: configData.config?.phase2Limit || 100,
          soldCount: countsData.phase2Count || 0,
          description: 'Standard pricing'
        },
        phase4: {
          id: 'phase_4',
          name: 'Phase 4',
          price: parseInt(configData.config?.phase4Price) || 450,
          isActive: configData.config?.isPhase4Active || false,
          capacity: configData.config?.phase4Limit || 100,
          soldCount: countsData.phase4Count || 0,
          description: 'Final pricing tier'
        },
        convenienceFee: 12.96,
        currency: 'INR',
        lastUpdated: new Date().toISOString()
      };

      return pricingConfig;
    },
    staleTime: PRICING_STALE_TIME,
    gcTime: PRICING_CACHE_TIME,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Set up real-time updates via polling
  useEffect(() => {
    const startPolling = () => {
      refreshIntervalRef.current = setInterval(async () => {
        try {
          await refetchConfig();
        } catch (error) {
          console.error('Failed to refresh pricing:', error);
          setError('Failed to update pricing data');
        }
      }, PRICING_STALE_TIME);
    };

    startPolling();

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [refetchConfig]);

  // Handle errors
  useEffect(() => {
    if (queryError) {
      setError(queryError.message || 'Failed to load pricing data');
    } else {
      setError(null);
    }
  }, [queryError]);

  const refreshPricing = useCallback(async () => {
    try {
      setError(null);
      await refetchConfig();
      
      // Also invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['ticket-counts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-ticket-config'] });
    } catch (error) {
      setError('Failed to refresh pricing data');
      throw error;
    }
  }, [refetchConfig, queryClient]);

  const formatCurrency = useCallback((amount: number): string => {
    if (!config) return `₹${amount.toFixed(2)}`;
    
    const formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: config.currency === 'INR' ? 'INR' : 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    return formatter.format(amount);
  }, [config]);

  const getAvailableTiers = useCallback((): PricingTier[] => {
    if (!config) return [];

    return [config.earlyBird, config.phase1, config.phase2].filter(tier => {
      // Check if tier is active and has capacity
      const hasCapacity = tier.soldCount < tier.capacity;
      return tier.isActive && hasCapacity;
    });
  }, [config]);

  const getCurrentTier = useCallback((): PricingTier | null => {
    const availableTiers = getAvailableTiers();
    
    // Return the first available tier (priority: early bird -> phase 1 -> phase 2)
    return availableTiers.length > 0 ? availableTiers[0] : null;
  }, [getAvailableTiers]);

  const calculateTotal = useCallback((
    ticketCount: number, 
    couponDiscount: number = 0
  ) => {
    const currentTier = getCurrentTier();
    
    if (!currentTier || !config) {
      return {
        subtotal: 0,
        discount: 0,
        convenienceFee: 0,
        total: 0
      };
    }

    const subtotal = currentTier.price * ticketCount;
    const discount = (subtotal * couponDiscount) / 100;
    const convenienceFee = config.convenienceFee * ticketCount;
    const total = subtotal - discount + convenienceFee;

    return {
      subtotal,
      discount,
      convenienceFee,
      total: Math.max(0, total) // Ensure total is never negative
    };
  }, [getCurrentTier, config]);

  return {
    config: config || null,
    currentTier: getCurrentTier(),
    isLoading,
    error,
    refreshPricing,
    formatCurrency,
    calculateTotal,
    getAvailableTiers,
    getCurrentTier
  };
}

// Export a wrapper hook for easier migration
export function useRealTimePricing() {
  return usePricing();
}