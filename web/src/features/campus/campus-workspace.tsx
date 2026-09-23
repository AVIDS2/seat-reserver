'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { CampusCode } from '@/config/campus-config';
import { usePlatformSession } from '@/features/auth/platform-session';
import { clearBookingDataCache } from '@/features/booking/api/service';

export type CampusScope = CampusCode | 'all';

type CampusWorkspaceContextValue = {
  activeCampus: CampusScope;
  setActiveCampus: (campus: CampusScope) => void;
};

const CampusWorkspaceContext = createContext<CampusWorkspaceContextValue | null>(null);

const CAMPUS_COOKIE = 'active_campus';

export function CampusWorkspaceProvider({
  children,
  initialCampus = 'cczu'
}: {
  children: React.ReactNode;
  initialCampus?: CampusScope;
}) {
  const user = usePlatformSession();
  const router = useRouter();
  const storageKey = `xiding.active-campus:${user?.id || 'anonymous'}`;
  const [activeCampus, setActiveCampusState] = useState<CampusScope>(initialCampus);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === 'all' || saved === 'cczu' || saved === 'njtech' || saved === 'jou') {
      setActiveCampusState(saved);
    } else {
      setActiveCampusState(initialCampus);
    }
  }, [initialCampus, storageKey]);

  const setActiveCampus = useCallback((campus: CampusScope) => {
    setActiveCampusState(campus);
    clearBookingDataCache();
    window.localStorage.setItem(storageKey, campus);
    document.cookie = `${CAMPUS_COOKIE}=${campus}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
  }, [router, storageKey]);

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
