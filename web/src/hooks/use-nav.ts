'use client';

import { useMemo } from 'react';
import type { NavGroup, NavItem } from '@/types';
import { usePlatformSession } from '@/features/auth/platform-session';

/**
 * Navigation filtering stays as a small seam so a real auth/RBAC provider can
 * be connected without changing the sidebar or command menu components.
 */
export function useFilteredNavItems(items: NavItem[]) {
  return useMemo(() => items, [items]);
}

export function useFilteredNavGroups(groups: NavGroup[]) {
  const user = usePlatformSession();
  return useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            if (!item.access?.role) return true;
            return item.access.role === user?.role;
          })
        }))
        .filter((group) => group.items.length > 0),
    [groups, user?.role]
  );
}
