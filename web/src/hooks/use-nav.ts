'use client';

import { useMemo } from 'react';
import type { NavGroup, NavItem } from '@/types';

/**
 * Navigation filtering stays as a small seam so a real auth/RBAC provider can
 * be connected without changing the sidebar or command menu components.
 */
export function useFilteredNavItems(items: NavItem[]) {
  return useMemo(() => items, [items]);
}

export function useFilteredNavGroups(groups: NavGroup[]) {
  return useMemo(() => groups, [groups]);
}
