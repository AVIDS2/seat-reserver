'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { getPlatformUser } from '../booking/api/service';
import type { PlatformUser } from '../booking/api/service';

type PlatformSessionContextValue = {
  user: PlatformUser | null;
  setUser: (user: PlatformUser | null) => void;
};

const PlatformSessionContext = createContext<PlatformSessionContextValue>({
  user: null,
  setUser: () => undefined
});

export function PlatformSessionProvider({
  initialUser,
  children
}: {
  initialUser: PlatformUser | null;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState(initialUser);

  useEffect(() => {
    if (user) return;
    void getPlatformUser().then(setUser).catch(() => setUser(null));
  }, [user]);

  return <PlatformSessionContext.Provider value={{ user, setUser }}>{children}</PlatformSessionContext.Provider>;
}

export function usePlatformSession(): PlatformUser | null {
  return useContext(PlatformSessionContext).user;
}

export function useSetPlatformSession(): (user: PlatformUser | null) => void {
  return useContext(PlatformSessionContext).setUser;
}
