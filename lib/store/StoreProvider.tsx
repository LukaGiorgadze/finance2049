/**
 * Store Provider
 *
 * Initializes the Legend-State store and provides loading state.
 * Must wrap the app to ensure store is ready before rendering.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeStore } from './index';
import { ensureSession, waitForInitialAuth } from '../supabase';
import { ONBOARDING_KEY } from '../../constants/storage-keys';

interface StoreContextValue {
  isReady: boolean;
}

const StoreContext = createContext<StoreContextValue>({ isReady: false });

export function useStoreReady(): boolean {
  return useContext(StoreContext).isReady;
}

interface StoreProviderProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function StoreProvider({ children, fallback }: StoreProviderProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function init() {
      const onboardingDone = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (onboardingDone) {
        await waitForInitialAuth();
        await ensureSession();
      }
      await initializeStore();
      setIsReady(true);
    }
    init();
  }, []);

  if (!isReady && fallback) {
    return <>{fallback}</>;
  }

  return (
    <StoreContext.Provider value={{ isReady }}>
      {children}
    </StoreContext.Provider>
  );
}
