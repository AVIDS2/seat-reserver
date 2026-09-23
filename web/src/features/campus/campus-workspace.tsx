'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { CampusCode } from '@/config/campus-config';
import { usePlatformSession } from '@/features/auth/platform-session';

export type CampusScope = CampusCode | 'all';

type CampusWorkspaceContextValue = {
  activeCampus: CampusScope;
  setActiveCampus: (campus: CampusScope) => void;
};

const CampusWorkspaceContext = createContext<CampusWorkspaceContextValue | null>(null);

export function CampusWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const user = usePlatformSession();
  const storageKey = `xiding.active-campus:${user?.id || 'anonymous'}`;
  const [activeCampus, setActiveCampusState] = useState<CampusScope>('cczu');

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === 'all' || saved === 'cczu' || saved === 'njtech' || saved === 'jou') {
      setActiveCampusState(saved);
    } else {
      setActiveCampusState('cczu');
    }
  }, [storageKey]);

  const setActiveCampus = useCallback((campus: CampusScope) => {
    setActiveCampusState(campus);
    window.localStorage.setItem(storageKey, campus);
  }, [storageKey]);

  const value = useMemo(
    () => ({ activeCampus, setActiveCampus }),
    [activeCampus, setActiveCampus]
  );

  return (
    <CampusWorkspaceContext.Provider value={value}>
      {children}
    </CampusWorkspaceContext.Provider>
  );
}

export function useCampusWorkspace(): CampusWorkspaceContextValue {
  const context = useContext(CampusWorkspaceContext);
  if (!context) {
    throw new Error('useCampusWorkspace must be used inside CampusWorkspaceProvider');
  }
  return context;
}
