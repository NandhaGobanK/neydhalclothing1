import { StoreTheme } from '../types/store';

export interface ThemeConfig {
  id: StoreTheme;
  name: string;
  primaryBg: string;
  primaryText: string;
  primaryHover: string;
  accentBg: string;
  accentText: string;
  badgeBg: string;
  badgeText: string;
  headerBg: string;
  headerBorder: string;
  accentBorder: string;
  ringColor: string;
  softBg: string;
}

export const THEME_CONFIGS: Record<StoreTheme, ThemeConfig> = {
  maroon: {
    id: 'maroon',
    name: 'Royal Maroon & Temple Gold',
    primaryBg: 'bg-rose-950',
    primaryText: 'text-rose-950',
    primaryHover: 'hover:bg-rose-900',
    accentBg: 'bg-amber-600',
    accentText: 'text-amber-700',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-900',
    headerBg: 'bg-rose-950',
    headerBorder: 'border-rose-900',
    accentBorder: 'border-amber-600',
    ringColor: 'focus:ring-rose-800',
    softBg: 'bg-rose-50/50',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Silk & Antique Brass',
    primaryBg: 'bg-emerald-950',
    primaryText: 'text-emerald-950',
    primaryHover: 'hover:bg-emerald-900',
    accentBg: 'bg-amber-600',
    accentText: 'text-amber-700',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-900',
    headerBg: 'bg-emerald-950',
    headerBorder: 'border-emerald-900',
    accentBorder: 'border-emerald-700',
    ringColor: 'focus:ring-emerald-800',
    softBg: 'bg-emerald-50/50',
  },
  sapphire: {
    id: 'sapphire',
    name: 'Midnight Sapphire & Zari',
    primaryBg: 'bg-indigo-950',
    primaryText: 'text-indigo-950',
    primaryHover: 'hover:bg-indigo-900',
    accentBg: 'bg-amber-500',
    accentText: 'text-amber-600',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-900',
    headerBg: 'bg-indigo-950',
    headerBorder: 'border-indigo-900',
    accentBorder: 'border-indigo-700',
    ringColor: 'focus:ring-indigo-800',
    softBg: 'bg-indigo-50/50',
  },
  rosewood: {
    id: 'rosewood',
    name: 'Plum Silk & Champagne',
    primaryBg: 'bg-purple-950',
    primaryText: 'text-purple-950',
    primaryHover: 'hover:bg-purple-900',
    accentBg: 'bg-amber-600',
    accentText: 'text-amber-700',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-900',
    headerBg: 'bg-purple-950',
    headerBorder: 'border-purple-900',
    accentBorder: 'border-purple-700',
    ringColor: 'focus:ring-purple-800',
    softBg: 'bg-purple-50/50',
  },
  gold: {
    id: 'gold',
    name: 'Warm Copper & Raw Umber',
    primaryBg: 'bg-amber-950',
    primaryText: 'text-amber-950',
    primaryHover: 'hover:bg-amber-900',
    accentBg: 'bg-yellow-600',
    accentText: 'text-yellow-700',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-950',
    headerBg: 'bg-amber-950',
    headerBorder: 'border-amber-900',
    accentBorder: 'border-amber-700',
    ringColor: 'focus:ring-amber-800',
    softBg: 'bg-amber-50/50',
  },
};
