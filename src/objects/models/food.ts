import type { VoxelGrid } from '../../voxel/grid';
import { fbm3 } from '../../voxel/noise';
import type { Palette } from '../../voxel/palette';
import { fillBox, fillCapsule, fillCylinderY, fillEllipsoid } from '../../voxel/shapes';
import { materialPalette } from '../helpers/kit';
import type { ObjectVariant, VoxelObject } from '../types';

function tones(palette: Palette): (name: string) => number {
  return (name) => palette.tone(palette.id(name), 'mid');
}

function sculpt(
  grid: VoxelGrid, ox: number, oy: number, oz: number, k: number,
  x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
  at: (X: number, Y: number, Z: number) => number,
): void {
  fillBox(grid, ox + x0 * k - 1, oy + y0 * k - 1, oz + z0 * k - 1, ox + x1 * k + 1, oy + y1 * k + 1, oz + z1 * k + 1,
    (x, y, z) => at((x + 0.5 - ox) / k, (y + 0.5 - oy) / k, (z + 0.5 - oz) / k));
}

function revolve(
  grid: VoxelGrid, cx: number, gy: number, cz: number, k: number,
  rMax: number, h0: number, h1: number,
  at: (r: number, h: number, a: number) => number,
): void {
  sculpt(grid, cx, gy, cz, k, -rMax, h0, -rMax, rMax, h1, rMax, (X, Y, Z) => (Y < h0 || Y > h1 ? 0 : at(Math.hypot(X, Z), Y, Math.atan2(Z, X))));
}

const snap = (v: number): number => Math.floor(v) + 0.5;

/* ==================== COFFEE CUP ==================== */

const CUP_GLAZE: Record<string, string> = { white: '#f2f0eb', red: '#b5242d', brown: '#6b4431' };
const COFFEE_VARIANTS: ObjectVariant[] = [
  { id: 'white', name: 'Porcelain white', color: '#f2f0eb' },
  { id: 'red', name: 'Glazed red', color: '#b5242d' },
  { id: 'brown', name: 'Stoneware brown', color: '#6b4431' },
];

export const coffeeCup: VoxelObject = {
  id: 'coffee-cup',
  name: 'Coffee Cup',
  description: 'A cappuccino with latte art in a cup and saucer.',
  category: 'food',
  variants: COFFEE_VARIANTS,
  createPalette(variantId) {
    return materialPalette('food', {
      glaze: CUP_GLAZE[variantId] ?? CUP_GLAZE.white,
      porcelain: '#f6f4ef',
      bisque: '#d8d0c0',
      coffee: '#3b2414',
      crema: '#a8703f',
      cremaRim: '#7a4a26',
      foam: '#f1e6d2',
      steel: '#c4c8ce',
    });
  },
  build(grid, palette, { layout, u, g }) {
    const c = layout.size / 2;
    const m = tones(palette);
    const GLAZE = m('glaze');
    const PORCELAIN = m('porcelain');
    const BISQUE = m('bisque');
    const k = 3.2 * u;

    const saucerTop = (r: number): number => (r < 3.3 ? 0.9 : r < 7.0 ? 0.9 + ((r - 3.3) / 3.7) * 1.1 : 2.0);
    const saucerUnder = (h: number): number => (h < 1.6 ? 3.5 + ((h - 0.4) / 1.2) * 4.25 : 7.75);
    revolve(grid, c, g, c, k, 7.8, 0, 2.05, (r, h) => {
      if (h < 0.4) return r >= 2.6 && r <= 3.3 ? BISQUE : 0;
      return r <= saucerUnder(h) && h <= saucerTop(r) ? GLAZE : 0;
    });

    const cupY = g + 0.9 * k;
    const wall = 0.42;
    const fill = 6.7;
    const outer = (hb: number): number => 2.55 + 2.2 * (1 - Math.pow(1 - Math.min(1, Math.max(0, (hb - 0.45) / 7.05)), 2.2));
    const crema = outer(fill) - wall;
    revolve(grid, c, cupY, c, k, 4.8, 0, 7.5, (r, hb, a) => {
      if (hb < 0.45) return r >= 2.0 && r <= 2.5 ? BISQUE : 0;
      const R = outer(hb);
      if (r > R) return 0;
      if (hb > 1.2 && r < R - wall) {
        if (hb > fill) return 0;
        if (hb + 1 / k <= fill) return m('coffee');
        const n = r / crema;
        if (n > 0.86) return m('cremaRim');
        const hx = n * Math.cos(a) * 1.9;
        const hy = -n * Math.sin(a) * 1.9 + 0.2;
        const heart = Math.pow(hx * hx + hy * hy - 1, 3) - hx * hx * hy * hy * hy;
        return heart <= 0 ? m('foam') : m('crema');
      }
      return hb < 0.75 ? PORCELAIN : GLAZE;
    });

    const hr = 0.58;
    const hCenter = [c - 4.4 * k, cupY + 4.1 * k];
    sculpt(grid, hCenter[0], hCenter[1], c, k, -2.1, -2.2, -hr, 0.4, 2.2, hr, (X, Y, Z) => {
      const dist = Math.abs(Math.hypot(X + 0.85, Y * 0.9) - 1.85);
      if (dist > hr) return 0;
      return dist > hr - 0.2 ? PORCELAIN : GLAZE;
    });

    const sy = g + 1.25 * k;
    const sx = c + 4.4 * k;
    const sz = c + 1.8 * k;
    const STEEL = m('steel');
    fillCapsule(grid, snap(sx - 1.6 * k), snap(sy), snap(sz - 4.6 * k), snap(sx + 1.4 * k), snap(sy + 0.3 * k), snap(sz + 3.8 * k), 0.25 * k, 0.25 * k, () => STEEL);
    fillEllipsoid(grid, snap(sx + 1.4 * k), snap(sy + 0.35 * k), snap(sz + 3.8 * k), 1.15 * k, 0.35 * k, 1.65 * k, () => STEEL);
  },
};

/* ==================== RESTAURANT ==================== */

const AWNING_COLORS: Record<string, string> = { red: '#b5242d', cream: '#e8dec5', teal: '#1f6460' };
const RESTAURANT_VARIANTS: ObjectVariant[] = [
  { id: 'red', name: 'Bistro red', color: '#b5242d' },
  { id: 'cream', name: 'Cream awning', color: '#e8dec5' },
  { id: 'teal', name: 'Seaside teal', color: '#1f6460' },
];

export const restaurant: VoxelObject = {
  id: 'restaurant',
  name: 'Bistro',
  description: 'A corner bistro with a striped awning and outdoor tables.',
  category: 'food',
  variants: RESTAURANT_VARIANTS,
  createPalette(variantId) {
    return materialPalette('food', {
      wall: '#f0ece1',
      brick: '#a6523f',
      wood: '#4a3222',
      door: '#3d2b1d',
      glass: '#2a4254',
      lit: { hex: '#ffe4aa', glow: true },
      awning: AWNING_COLORS[variantId] ?? AWNING_COLORS.red,
      awningAlt: '#f5f0e1',
      slate: '#3d434a',
      copper: '#3d7a64',
      brass: '#d4aa48',
      chair: '#2c4232',
      tableTop: '#ffffff',
      chalkboard: '#232926',
      menuText: '#ebe7d8',
      paving: '#cfc8b8',
    });
  },
  build(grid, palette, { layout, u, g }) {
    const c = layout.size / 2;
    const m = tones(palette);
    const k = 1.35 * u;
    const WALL = m('wall');
    const BRICK = m('brick');
    const WOOD = m('wood');
    const GLASS = m('glass');
    const LIT = m('lit');
    const AWNING = m('awning');
    const ALT = m('awningAlt');
    const SLATE = m('slate');

    fillBox(grid, Math.floor(c - 18 * k), g, Math.floor(c - 14 * k), Math.ceil(c + 18 * k), g + Math.ceil(1.2 * k), Math.ceil(c + 18 * k), () => m('paving'));

    const bX0 = Math.floor(c - 16 * k);
    const bX1 = Math.ceil(c + 16 * k);
    const bZ0 = Math.floor(c - 12 * k);
    const bZ1 = Math.ceil(c + 12 * k);
    const roofY = g + Math.ceil(14.5 * k);
    fillBox(grid, bX0, g + Math.ceil(1.2 * k), bZ0, bX1, roofY, bZ1, (x, y, z) => {
      const front = z >= bZ1 - Math.ceil(1.2 * k);
      const py = (y + 0.5 - g) / k;
      const px = (x + 0.5 - c) / k;
      if (py < 4.2) return BRICK;
      if (front) {
        if (py > 5.2 && py < 12.5) {
          if (Math.abs(px) < 3.2 && py < 11.2) return m('door');
          if ((px > -13.5 && px < -4.8) || (px > 4.8 && px < 13.5)) return GLASS;
        }
        if (py > 13.2) return WOOD;
      }
      return WALL;
    });

    fillBox(grid, bX0 - Math.ceil(0.8 * k), roofY, bZ0 - Math.ceil(0.8 * k), bX1 + Math.ceil(0.8 * k), roofY + Math.ceil(1.2 * k), bZ1 + Math.ceil(0.8 * k), () => SLATE);
    sculpt(grid, c, roofY + 1.2 * k, (bZ0 + bZ1) / 2, k, -16.5, 0, -12.5, 16.5, 5.5, 12.5, (X, Y, Z) => {
      const d = Math.abs(Z);
      const h = Y / 0.55;
      return d <= 12.5 - h ? SLATE : 0;
    });

    const awnY0 = g + 9.5 * k;
    const awnY1 = g + 12.5 * k;
    const awnZ0 = bZ1;
    const awnZ1 = bZ1 + 4.2 * k;
    fillBox(grid, bX0 - Math.ceil(0.5 * k), Math.floor(awnY0), awnZ0, bX1 + Math.ceil(0.5 * k), Math.ceil(awnY1), Math.ceil(awnZ1), (x, y, z) => {
      const px = (x + 0.5 - c) / k;
      const py = (y + 0.5 - g) / k;
      const pz = (z + 0.5 - bZ1) / k;
      const slope = (pz / 4.2) * 3.0;
      if (py < 12.5 - slope - 0.4 || py > 12.5 - slope + 0.4) return 0;
      return Math.floor((px + 20) / 1.6) % 2 === 0 ? AWNING : ALT;
    });

    const chairM = m('chair');
    const tableM = m('tableTop');
    for (const tx of [-9 * k, 9 * k]) {
      const tX = snap(c + tx);
      const tZ = snap(bZ1 + 2.5 * k);
      fillCylinderY(grid, tX, tZ, g + 1.2 * k, g + 4.5 * k, 0.4 * k, () => m('copper'));
      fillCylinderY(grid, tX, tZ, g + 4.5 * k, g + 4.8 * k, 2.6 * k, () => tableM);
      for (const cx of [-2.4 * k, 2.4 * k]) {
        const cX = snap(tX + cx);
        fillBox(grid, cX - 1.1 * k, g + 1.2 * k, tZ - 1.1 * k, cX + 1.1 * k, g + 2.8 * k, tZ + 1.1 * k, () => chairM);
        fillBox(grid, cX + (cx < 0 ? -1.1 : 0.8) * k, g + 2.8 * k, tZ - 1.1 * k, cX + (cx < 0 ? -0.8 : 1.1) * k, g + 5.6 * k, tZ + 1.1 * k, () => chairM);
      }
    }

    const menuX = snap(c - 14.5 * k);
    const menuZ = snap(bZ1 + 1.8 * k);
    fillBox(grid, menuX - 1.8 * k, g + 1.2 * k, menuZ - 0.3 * k, menuX + 1.8 * k, g + 6.2 * k, menuZ + 0.3 * k, () => m('chalkboard'));
  },
};

/* ==================== BURGER ==================== */

const BURGER_VARIANTS: ObjectVariant[] = [
  { id: 'gold', name: 'Classic sesame', color: '#d69736' },
  { id: 'brown', name: 'Brioche', color: '#b56d28' },
  { id: 'orange', name: 'Spicy cheddar', color: '#e8721c' },
];

export const burger: VoxelObject = {
  id: 'burger',
  name: 'Burger',
  description: 'A stacked cheeseburger with lettuce, tomato, cheese and pickles.',
  category: 'food',
  variants: BURGER_VARIANTS,
  createPalette(variantId) {
    const mainColor = BURGER_VARIANTS.find((v) => v.id === variantId)?.color ?? BURGER_VARIANTS[0].color;
    return materialPalette('food', {
      bun: mainColor,
      bunBottom: '#c4842b',
      patty: '#422517',
      cheese: '#f5a718',
      lettuce: '#4d9e38',
      tomato: '#c92a2a',
      pickle: '#3b6e2e',
      onion: '#ab3a6b',
      sesame: '#f7eed7',
      plate: '#e3ded8',
    });
  },
  build(grid, palette, { layout, u, g }) {
    const c = layout.size / 2;
    const m = tones(palette);
    const k = 2.4 * u;
    const BUN = m('bun');
    const PATTY = m('patty');
    const CHEESE = m('cheese');
    const LETTUCE = m('lettuce');
    const TOMATO = m('tomato');

    fillCylinderY(grid, c, c, g, g + 0.8 * k, 7.5 * k, () => m('plate'));

    const bY = g + 0.8 * k;
    revolve(grid, c, bY, c, k, 6.2, 0, 1.8, (r, h) => (h < 0.4 ? (r < 5.4 ? m('bunBottom') : 0) : r < 5.8 ? BUN : 0));

    sculpt(grid, c, bY + 1.8 * k, c, k, -6.5, 0, -6.5, 6.5, 0.9, 6.5, (X, Y, Z) => {
      const r = Math.hypot(X, Z);
      const wave = Math.sin(X * 1.8) * Math.cos(Z * 1.8) * 0.25;
      return r < 6.0 + wave && Y < 0.7 + wave * 0.3 ? LETTUCE : 0;
    });

    revolve(grid, c, bY + 2.5 * k, c, k, 6.0, 0, 1.6, (r) => (r < 5.6 ? PATTY : 0));

    sculpt(grid, c, bY + 3.9 * k, c, k, -6.2, 0, -6.2, 6.2, 0.4, 6.2, (X, Y, Z) => {
      if (Math.abs(X) < 5.2 && Math.abs(Z) < 5.2) return CHEESE;
      const corner = Math.max(Math.abs(X), Math.abs(Z));
      if (corner < 6.0 && (Math.abs(X) > 4.8 || Math.abs(Z) > 4.8)) return CHEESE;
      return 0;
    });

    for (const [tx, tz] of [[-2.4, -1.8], [2.2, 1.9]]) {
      revolve(grid, c + tx * k, bY + 4.3 * k, c + tz * k, k, 2.8, 0, 0.8, (r) => (r < 2.6 ? TOMATO : 0));
    }

    revolve(grid, c, bY + 5.1 * k, c, k, 6.2, 0, 3.8, (r, h) => {
      const cap = Math.sqrt(Math.max(0, 1 - Math.pow(h / 3.8, 1.8))) * 5.8;
      return r < cap ? BUN : 0;
    });

    const SESAME = m('sesame');
    const seedY = bY + 7.6 * k;
    for (const [sx, sz] of [[-2.2, -1.5], [1.8, -2.4], [0.5, 2.2], [-3.1, 1.8], [2.8, 1.2]]) {
      fillEllipsoid(grid, snap(c + sx * k), snap(seedY), snap(c + sz * k), 0.4 * k, 0.2 * k, 0.6 * k, () => SESAME);
    }
  },
};

/* ==================== CAKE ==================== */

const CAKE_ICING: Record<string, string> = { pink: '#f092b0', cream: '#f5ead3', purple: '#9b72cf' };
const CAKE_VARIANTS: ObjectVariant[] = [
  { id: 'pink', name: 'Strawberry pink', color: '#f092b0' },
  { id: 'cream', name: 'Vanilla cream', color: '#f5ead3' },
  { id: 'purple', name: 'Berry purple', color: '#9b72cf' },
];

export const cake: VoxelObject = {
  id: 'cake',
  name: 'Cake',
  description: 'A two-tier celebration cake with strawberries and candles.',
  category: 'food',
  variants: CAKE_VARIANTS,
  createPalette(variantId) {
    const mainColor = CAKE_ICING[variantId] ?? CAKE_ICING.pink;
    return materialPalette('food', {
      icing: mainColor,
      frosting: '#ffffff',
      sponge: '#e8c897',
      jam: '#c92a42',
      berry: '#b81d35',
      leaf: '#3e8a38',
      candle: '#4aa3df',
      flame: { hex: '#ff9800', glow: true },
      plate: '#f0ede6',
    });
  },
  build(grid, palette, { layout, u, g }) {
    const c = layout.size / 2;
    const m = tones(palette);
    const k = 2.2 * u;
    const ICING = m('icing');
    const FROSTING = m('frosting');
    const BERRY = m('berry');
    const CANDLE = m('candle');

    fillCylinderY(grid, c, c, g, g + 0.8 * k, 8.2 * k, () => m('plate'));

    const bY = g + 0.8 * k;
    revolve(grid, c, bY, c, k, 7.2, 0, 4.2, (r, h) => {
      if (r > 6.8) return 0;
      if (r > 6.3 || h > 3.8 || h < 0.4) return ICING;
      if (h > 1.8 && h < 2.3) return FROSTING;
      return m('sponge');
    });

    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      const bx = snap(c + Math.cos(a) * 6.4 * k);
      const bz = snap(c + Math.sin(a) * 6.4 * k);
      fillEllipsoid(grid, bx, bY + 4.2 * k, bz, 0.7 * k, 0.6 * k, 0.7 * k, () => FROSTING);
    }

    const tY = bY + 4.2 * k;
    revolve(grid, c, tY, c, k, 4.8, 0, 3.6, (r, h) => {
      if (r > 4.4) return 0;
      if (r > 3.9 || h > 3.2 || h < 0.4) return ICING;
      if (h > 1.5 && h < 1.9) return FROSTING;
      return m('sponge');
    });

    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      const bx = snap(c + Math.cos(a) * 4.0 * k);
      const bz = snap(c + Math.sin(a) * 4.0 * k);
      fillEllipsoid(grid, bx, tY + 3.6 * k, bz, 0.6 * k, 0.8 * k, 0.6 * k, () => BERRY);
    }

    const candleY = tY + 3.6 * k;
    const FLAME = m('flame');
    for (const [cx, cz] of [[-1.8, -1.8], [1.8, -1.8], [0, 2.0]]) {
      const cX = snap(c + cx * k);
      const cZ = snap(c + cz * k);
      fillCylinderY(grid, cX, cZ, candleY, candleY + 2.8 * k, 0.35 * k, () => CANDLE);
      fillEllipsoid(grid, cX, candleY + 3.3 * k, cZ, 0.35 * k, 0.6 * k, 0.35 * k, () => FLAME);
    }
  },
};

