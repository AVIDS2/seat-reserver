'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { getPlatformUser } from '../booking/api/service';
import type { PlatformUser } from '../booking/api/service';

const PlatformSessionContext = createContext<PlatformUser | null>(null);

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

  return <PlatformSessionContext.Provider value={user}>{children}</PlatformSessionContext.Provider>;
}

export function usePlatformSession(): PlatformUser | null {
  return useContext(PlatformSessionContext);
}
