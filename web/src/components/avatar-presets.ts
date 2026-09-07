export const avatarPresets = [
  { id: 'aurora', label: '极光', className: 'bg-sky-600 text-white' },
  { id: 'sunrise', label: '日出', className: 'bg-amber-500 text-white' },
  { id: 'meadow', label: '草木', className: 'bg-emerald-600 text-white' },
  { id: 'berry', label: '莓果', className: 'bg-rose-600 text-white' },
  { id: 'ink', label: '墨色', className: 'bg-slate-900 text-white' }
] as const;

export type AvatarPresetId = (typeof avatarPresets)[number]['id'];

const AVATAR_PRESET_KEY = 'seat-platform:avatar-preset';

export function getAvatarPreset(): AvatarPresetId {
  if (typeof window === 'undefined') return 'aurora';
  const value = window.localStorage.getItem(AVATAR_PRESET_KEY);
  return avatarPresets.some((preset) => preset.id === value)
    ? (value as AvatarPresetId)
    : 'aurora';
}

export function setAvatarPreset(value: AvatarPresetId): void {
  window.localStorage.setItem(AVATAR_PRESET_KEY, value);
  window.dispatchEvent(new CustomEvent('seat-avatar-change', { detail: value }));
}

export function avatarPresetClass(value: string | undefined): string {
  return avatarPresets.find((preset) => preset.id === value)?.className ?? avatarPresets[0].className;
}
