import { Palette } from '../../voxel/palette';
import { addGroundFamilies, paletteSet, type GroundTheme } from './common';
import type { PaletteSet } from '../types';

export const CATEGORY_GROUND: Record<string, GroundTheme> = {
  tech: { tileA: ['#2a2d34', '#8a8f98', '#cfd3da'], tileB: ['#30343c', '#868b94', '#c4c8d0'], accent: ['#0f3a5a', '#3a8ac8', '#a8d8ff'] },
  medical: { tileA: ['#4a3f48', '#a79ea4', '#f3ede6'], tileB: ['#3f4a45', '#a2aaa4', '#ebe8de'], accent: ['#7a1020', '#e05060', '#ffc0c8'] },
  education: { tileA: ['#4a3f48', '#a79ea4', '#f3ede6'], tileB: ['#3f4a45', '#a2aaa4', '#ebe8de'], accent: ['#2d5a3a', '#8fb98a', '#d3e8b8'] },
  nature: { tileA: ['#4a3f48', '#a79ea4', '#f3ede6'], tileB: ['#3f4a45', '#a2aaa4', '#ebe8de'], accent: ['#2d5a3a', '#8fb98a', '#d3e8b8'] },
  vehicles: { tileA: ['#2a2d34', '#8a8f98', '#cfd3da'], tileB: ['#30343c', '#868b94', '#c4c8d0'], accent: ['#8a4b0c', '#e0a050', '#ffe0a8'] },
  business: { tileA: ['#2a2d34', '#8a8f98', '#cfd3da'], tileB: ['#30343c', '#868b94', '#c4c8d0'], accent: ['#6a5a00', '#c8a020', '#ffedb0'] },
  food: { tileA: ['#4a3f48', '#a79ea4', '#f3ede6'], tileB: ['#3f4a45', '#a2aaa4', '#ebe8de'], accent: ['#8a4b0c', '#e0a050', '#ffe0a8'] },
  sports: { tileA: ['#2a2d34', '#8a8f98', '#cfd3da'], tileB: ['#30343c', '#868b94', '#c4c8d0'], accent: ['#1d5a2a', '#4fa05a', '#c0e8c0'] },
};

export const SAFE_MAINS: Record<string, [string, string, string]> = {
  red: ['#5a0b12', '#c8232c', '#ffb9b0'],
  blue: ['#0f2a5a', '#2563c8', '#a9c8ff'],
  green: ['#0f3a1d', '#2a8a3a', '#a8e0b0'],
  yellow: ['#6a4a00', '#f2b705', '#fff0a0'],
  purple: ['#3a1a5a', '#7a3ac8', '#d0b0ff'],
  teal: ['#0a3a3a', '#1a8a8a', '#a0e8e8'],
  orange: ['#6a2a0c', '#ff7a1a', '#ffe0c0'],
  pink: ['#8a2a52', '#f2a6c1', '#ffeaf2'],
  white: ['#5b6270', '#eceef2', '#ffffff'],
  brown: ['#2c1a10', '#5a3a27', '#d8b894'],
  gray: ['#2a2d34', '#6a7078', '#d4d8de'],
  navy: ['#0e1722', '#2b4b66', '#a8d0ea'],
};

export const TRIM: [string, string, string] = ['#0f1013', '#2a2d33', '#9aa0aa'];
export const GLASS: [string, string, string] = ['#0e1722', '#2b4b66', '#c8e4f8'];
export const TIRE: [string, string, string] = ['#0b0b0d', '#1c1e22', '#8a8f96'];
export const GOLD: [string, string, string] = ['#6a4a00', '#f2b705', '#fff0a0'];
export const CREAM: [string, string, string] = ['#6a5a40', '#d8c8a8', '#fff4e0'];

export function standardPalette(category: string, main: [string, string, string], glow: [string, string, string] = GOLD): PaletteSet {
  const palette = new Palette();
  palette.addFamily('main', ...main);
  palette.addFamily('trim', ...TRIM);
  palette.addFamily('glass', ...GLASS);
  palette.addFamily('tire', ...TIRE);
  palette.addFamily('glow', ...glow, true);
  palette.addFamily('cream', ...CREAM);
  const ground = addGroundFamilies(palette, CATEGORY_GROUND[category] ?? CATEGORY_GROUND.tech);
  return paletteSet(palette, ground);
}

function hexToHsl(hex: string): [number, number, number] {
  const v = parseInt(hex.replace('#', ''), 16);
  const r = ((v >> 16) & 255) / 255;
  const g = ((v >> 8) & 255) / 255;
  const b = (v & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number): string => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function scanTones(hex: string): [string, string] {
  const [h, s] = hexToHsl(hex);
  return [hslToHex(h, Math.min(s, 0.55), 0.13), hslToHex(h, Math.min(s, 0.6), 0.9)];
}

export function addMaterial(palette: Palette, name: string, hex: string, emissive = false): number {
  const [dark, light] = scanTones(hex);
  return palette.addFamily(name, dark, hex, light, emissive);
}

export function solid(palette: Palette, family: number): () => number {
  const material = palette.tone(family, 'mid');
  return () => material;
}

export function materialPalette<K extends string>(
  category: string,
  colors: Record<K, string | { hex: string; glow: true }>,
): PaletteSet & { ids: Record<K, number> } {
  const palette = new Palette();
  const ids = {} as Record<K, number>;
  for (const name of Object.keys(colors) as K[]) {
    const c = colors[name];
    ids[name] = typeof c === 'string' ? addMaterial(palette, name, c) : addMaterial(palette, name, c.hex, true);
  }
  const ground = addGroundFamilies(palette, CATEGORY_GROUND[category] ?? CATEGORY_GROUND.tech);
  return { ...paletteSet(palette, ground), ids };
}

