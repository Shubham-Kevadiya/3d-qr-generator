import { fbm3, hash3, mulberry32, valueNoise3 } from '../../voxel/noise';
import { luminance, Palette } from '../../voxel/palette';
import type { VoxelGrid } from '../../voxel/grid';
import { inRim } from '../../voxel/layout';
import { fillBox, fillCapsule, fillEllipsoid, fillLathe, type Chooser } from '../../voxel/shapes';
import { addGrass, addGroundFamilies, addStones, paletteSet } from '../helpers/common';
import { CATEGORY_GROUND } from '../helpers/kit';
import type { ObjectContext, ObjectVariant, VoxelObject } from '../types';

interface Point {
  x: number;
  y: number;
  z: number;
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

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const f = (n: number): number => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return [f(0), f(8), f(4)];
}

function toneWithLuminance(h: number, s: number, target: number): string {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const l = (lo + hi) / 2;
    if (luminance(...hslToRgb(h, s, l)) < target) lo = l;
    else hi = l;
  }
  return '#' + hslToRgb(h, s, (lo + hi) / 2).map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function addNatural(palette: Palette, name: string, hex: string, emissive = false): number {
  const [h, s] = hexToHsl(hex);
  return palette.addFamily(name, toneWithLuminance(h, Math.min(s, 0.5), 62), hex, toneWithLuminance(h, Math.min(s, 0.55), 234), emissive);
}

export function scatterLitter(
  grid: VoxelGrid, ctx: ObjectContext, materials: number[], chance: number, cx: number, cz: number, radius: number, seed: number,
): void {
  const { size } = ctx.layout;
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      if (inRim(ctx.layout, x, z) || grid.get(x, ctx.g, z) !== 0) continue;
      const r = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
      if (hash3(x, 5, z, seed) >= chance * Math.exp(-Math.pow(r / radius, 2))) continue;
      grid.set(x, ctx.g, z, materials[Math.floor(hash3(x, 6, z, seed) * materials.length)]);
    }
  }
}

function branch(grid: VoxelGrid, points: Point[], r0: number, r1: number, choose: Chooser): void {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const ra = r0 + (r1 - r0) * (i / (points.length - 1));
    const rb = r0 + (r1 - r0) * ((i + 1) / (points.length - 1));
    fillCapsule(grid, a.x, a.y, a.z, b.x, b.y, b.z, ra, rb, choose);
  }
}

/* ==================== CHERRY TREE ==================== */

interface CherryColors {
  shade: string; mid: string; sun: string; leaf: string; bark: string;
}

const CHERRY_COLORS: Record<string, CherryColors> = {
  blossom: { shade: '#e7a3b9', mid: '#f4c3d2', sun: '#fde3ea', leaf: '#8a6a3c', bark: '#4a3832' },
  lavender: { shade: '#8a7bc9', mid: '#a597dc', sun: '#c4b9ec', leaf: '#6f8f4a', bark: '#57483c' },
  coral: { shade: '#d0577f', mid: '#e47a9c', sun: '#f3a6bf', leaf: '#7a4a2c', bark: '#45332c' },
  snow: { shade: '#dcdfe4', mid: '#f1f2f0', sun: '#ffffff', leaf: '#7d8f4c', bark: '#4f433d' },
};

const CHERRY_VARIANTS: ObjectVariant[] = [
  { id: 'blossom', name: 'Yoshino pink', color: '#f4c3d2' },
  { id: 'lavender', name: 'Jacaranda', color: '#a597dc' },
  { id: 'coral', name: 'Kanzan', color: '#e47a9c' },
  { id: 'snow', name: 'White cherry', color: '#f1f2f0' },
];

export const cherryTree: VoxelObject = {
  id: 'cherry-tree',
  name: 'Cherry Tree',
  description: 'A flowering cherry with paper lanterns.',
  category: 'nature',
  variants: CHERRY_VARIANTS,
  createPalette(variantId) {
    const c = CHERRY_COLORS[variantId] ?? CHERRY_COLORS.blossom;
    const palette = new Palette();
    addNatural(palette, 'bark', c.bark);
    addNatural(palette, 'barkBand', '#6e6058');
    addNatural(palette, 'blossomShade', c.shade);
    addNatural(palette, 'blossom', c.mid);
    addNatural(palette, 'blossomSun', c.sun);
    addNatural(palette, 'leaf', c.leaf);
    palette.addFamily('grass', '#2c5530', '#5f9a45', '#b6d98a');
    addNatural(palette, 'paper', '#ffb04a', true);
    addNatural(palette, 'lacquer', '#2a1d18');
    addNatural(palette, 'cord', '#3a2c22');
    const ground = addGroundFamilies(palette, {
      tileA: ['#4a3f48', '#a79ea4', '#f3ede6'],
      tileB: ['#3f4a45', '#a2aaa4', '#ebe8de'],
      accent: ['#2d5a3a', '#8fb98a', '#d3e8b8'],
    });
    return paletteSet(palette, ground);
  },
  build(grid, palette, ctx) {
    const { layout, seed, u, g } = ctx;
    const rng = mulberry32(seed);
    const c = layout.size / 2;
    const mid = (name: string): number => palette.tone(palette.id(name), 'mid');
    const BARK = mid('bark');
    const BAND = mid('barkBand');
    const SHADE = mid('blossomShade');
    const BLOSSOM = mid('blossom');
    const SUN = mid('blossomSun');
    const LEAF = mid('leaf');
    const PAPER = mid('paper');
    const LACQUER = mid('lacquer');
    const CORD = mid('cord');

    const bark: Chooser = (x, y, z) => (fbm3((x / u) * 0.35, (y / u) * 1.5, (z / u) * 0.35, seed + 1) > 0.66 ? BAND : BARK);
    const aboveGround = (choose: Chooser): Chooser => (x, y, z) => (y >= g ? choose(x, y, z) : 0);

    const leanA = rng() * Math.PI * 2;
    const leanD = (1 + rng() * 1.2) * u;
    const forkH = 13 * u;
    const trunkAt = (s: number): Point => {
      const side = Math.sin(s * Math.PI * 2) * 0.6 * u;
      return {
        x: c + Math.cos(leanA) * leanD * s + Math.cos(leanA + Math.PI / 2) * side,
        y: g + forkH * s,
        z: c + Math.sin(leanA) * leanD * s + Math.sin(leanA + Math.PI / 2) * side,
      };
    };
    const trunk: Point[] = [];
    for (let i = 0; i <= 8; i++) trunk.push(trunkAt(i / 8));
    branch(grid, trunk, 2.6 * u, 2.1 * u, bark);
    const fork = trunkAt(1);

    const lobe = rng() * Math.PI * 2;
    fillBox(grid, c - 7 * u, g, c - 7 * u, c + 7 * u, g + 4.5 * u, c + 7 * u, (x, y, z) => {
      const dx = x + 0.5 - c;
      const dz = z + 0.5 - c;
      const h = y + 0.5 - g;
      const lobes = Math.pow(Math.max(0, Math.cos(5 * Math.atan2(dz, dx) + lobe)), 2);
      const r = 2.6 * u + 2.2 * u * Math.exp(-h / (1.2 * u)) * (0.45 + 0.55 * lobes);
      return dx * dx + dz * dz <= r * r ? bark(x, y, z) : 0;
    });
    for (let i = 0; i < 5; i++) {
      const a = lobe / 5 + (i / 5) * Math.PI * 2 + (rng() - 0.5) * 0.3;
      const reach = (6 + rng() * 2.5) * u;
      fillCapsule(grid, c + Math.cos(a) * 2 * u, g + 1 * u, c + Math.sin(a) * 2 * u,
        c + Math.cos(a) * reach, g + 0.2 * u, c + Math.sin(a) * reach, 1.3 * u, 0.6 * u, aboveGround(bark));
    }

    const clusters: { p: Point; r: number }[] = [];
    const MAX_SPREAD = 20 * u;
    const addCluster = (p: Point, r: number): void => {
      const dx = p.x - c;
      const dz = p.z - c;
      const d = Math.hypot(dx, dz);
      const k = d > MAX_SPREAD ? MAX_SPREAD / d : 1;
      clusters.push({ p: { x: c + dx * k, y: p.y, z: c + dz * k }, r });
    };
    const limbStart = rng() * Math.PI * 2;
    const limbs: { az: number; reach: number; rise: number; r0: number; droop: number }[] = [];
    for (let i = 0; i < 5; i++) {
      limbs.push({
        az: limbStart + (i / 5) * Math.PI * 2 + (rng() - 0.5) * 0.5,
        reach: (15 + rng() * 3) * u,
        rise: (14 + rng() * 4) * u,
        r0: 1.9 * u,
        droop: 3 * u,
      });
    }
    for (let i = 0; i < 2; i++) {
      limbs.push({ az: limbStart + Math.PI / 5 + i * Math.PI, reach: (4 + rng() * 2) * u, rise: (19 + rng() * 3) * u, r0: 1.5 * u, droop: 0 });
    }
    for (const limb of limbs) {
      const bend = (rng() - 0.5) * 0.35;
      const limbAt = (s: number): Point => {
        const a = limb.az + bend * Math.sin(s * Math.PI);
        return {
          x: fork.x + Math.cos(a) * limb.reach * s,
          y: fork.y - 1.5 * u + limb.rise * (1 - (1 - s) * (1 - s)) - limb.droop * Math.pow(s, 4),
          z: fork.z + Math.sin(a) * limb.reach * s,
        };
      };
      const path: Point[] = [];
      for (let k = 0; k <= 6; k++) path.push(limbAt(k / 6));
      branch(grid, path, limb.r0, 0.8 * u, bark);
      const upright = limb.droop === 0;
      for (const s of upright ? [0.75, 1] : [0.55, 0.78, 0.96]) {
        addCluster({ ...limbAt(s), y: limbAt(s).y + 1.4 * u }, (upright ? 5.4 : 4.4) + rng() * 1.2);
      }
      for (const s of upright ? [0.6] : [0.4, 0.7]) {
        const start = limbAt(s);
        const a2 = limb.az + (rng() < 0.5 ? -1 : 1) * (0.55 + rng() * 0.35);
        const len = (7 + rng() * 3) * u;
        const up = (upright ? 6 : 4 + rng() * 3) * u;
        const twigAt = (t: number): Point => ({
          x: start.x + Math.cos(a2) * len * t,
          y: start.y + up * Math.sin(t * Math.PI * 0.6) - 1.2 * u * t * t,
          z: start.z + Math.sin(a2) * len * t,
        });
        branch(grid, [twigAt(0), twigAt(0.35), twigAt(0.7), twigAt(1)], 1 * u, 0.55 * u, bark);
        addCluster({ ...twigAt(0.55), y: twigAt(0.55).y + 1.3 * u }, 4 + rng() * 1.2);
        addCluster({ ...twigAt(1), y: twigAt(1).y + 1 * u }, 4.4 + rng() * 1.3);
      }
    }

    const wobble = (x: number, y: number, z: number): number => (fbm3((x / u) * 0.5, (y / u) * 0.5, (z / u) * 0.5, seed + 9) - 0.5) * 1.6;
    for (const { p, r } of clusters) {
      const ry = r * 0.72 * u;
      const blossom: Chooser = (x, y, z) => {
        const X = x / u;
        const Y = y / u;
        const Z = z / u;
        if (fbm3(X * 0.6, Y * 0.6, Z * 0.6, seed + 50) > 0.8) return LEAF;
        const light = 0.5 + ((y + 0.5 - p.y) / ry) * 0.42 + (fbm3(X * 0.25, Y * 0.25, Z * 0.25, seed + 3) - 0.5) * 0.7;
        return light < 0.36 ? SHADE : light > 0.72 ? SUN : BLOSSOM;
      };
      fillEllipsoid(grid, p.x, p.y, p.z, r * u, ry, r * u, blossom, wobble);
    }

    const hung: Point[] = [];
    for (let attempt = 0; attempt < 60 && hung.length < 5; attempt++) {
      const a = rng() * Math.PI * 2;
      const d = (9 + rng() * 8) * u;
      const lx = Math.floor(c + Math.cos(a) * d);
      const lz = Math.floor(c + Math.sin(a) * d);
      if (hung.some((h) => Math.hypot(h.x - lx, h.z - lz) < 7 * u)) continue;
      let anchor = -1;
      for (let y = Math.floor(g + 12 * u); y < grid.height; y++) {
        if (grid.solid(lx, y, lz)) { anchor = y; break; }
      }
      if (anchor < 0) continue;
      const cord = Math.max(2, Math.round((1.5 + rng() * 2) * u));
      const lanternH = 3 * u;
      const top = anchor - cord;
      const bottom = top - lanternH;
      if (bottom < g + 8 * u) continue;
      let clear = true;
      for (let y = Math.floor(bottom) - 1; y < anchor && clear; y++) {
        for (let dz = -2; dz <= 2 && clear; dz++) for (let dx = -2; dx <= 2; dx++) if (grid.solid(lx + dx, y, lz + dz)) clear = false;
      }
      if (!clear) continue;
      for (let y = top; y < anchor; y++) grid.set(lx, y, lz, CORD);
      const r = Math.max(1, 1.2 * u);
      fillLathe(grid, lx + 0.5, lz + 0.5, bottom, top, (t) => r * (0.72 + 0.28 * Math.sin(t * Math.PI)), (x, y) =>
        y < bottom + 0.6 * u || y >= top - 0.6 * u ? LACQUER : PAPER);
      hung.push({ x: lx, y: anchor, z: lz });
    }

    scatterLitter(grid, ctx, [BLOSSOM, SUN, SHADE], 0.2, c, c, 22 * u, seed + 21);
    addGrass(grid, palette, ctx, { family: palette.id('grass'), density: 0.03, finderBoost: 0.28, maxHeight: Math.max(2, Math.round(1.6 * u)), seed: seed + 41 });
    addStones(grid, palette, ctx, palette.id('rock'), rng, 3);
  },
};

/* ==================== PINE TREE ==================== */

interface PineColors {
  needles: [string, string, string, string];
  tile: [string, string, string];
  spray: number;
  branches: number;
  snow: boolean;
}

const PINE_COLORS: Record<string, PineColors> = {
  evergreen: { needles: ['#1f3d27', '#2c5534', '#3d6c3f', '#6a9a4a'], tile: ['#2d3b36', '#9aa8a0', '#e6efe9'], spray: 0.34, branches: 6, snow: false },
  frost: { needles: ['#2c4850', '#466c74', '#628a90', '#86aaa8'], tile: ['#2b3a47', '#a1b0bd', '#eef4fa'], spray: 0.34, branches: 6, snow: true },
  larch: { needles: ['#8a5a1e', '#bf8630', '#dcaa48', '#ecc664'], tile: ['#4a3a2a', '#b3a58f', '#f5ecd9'], spray: 0.24, branches: 4, snow: false },
};

const PINE_SETTINGS = new WeakMap<Palette, PineColors>();

const PINE_VARIANTS: ObjectVariant[] = [
  { id: 'evergreen', name: 'Norway spruce', color: '#2c5534' },
  { id: 'frost', name: 'Snowy blue spruce', color: '#9ccbe0' },
  { id: 'larch', name: 'Autumn larch', color: '#bf8630' },
];

export const pineTree: VoxelObject = {
  id: 'pine-tree',
  name: 'Pine Tree',
  description: 'A tall evergreen strung with fairy lights.',
  category: 'nature',
  variants: PINE_VARIANTS,
  createPalette(variantId) {
    const c = PINE_COLORS[variantId] ?? PINE_COLORS.evergreen;
    const palette = new Palette();
    PINE_SETTINGS.set(palette, c);
    addNatural(palette, 'needleShade', c.needles[0]);
    addNatural(palette, 'needle', c.needles[1]);
    addNatural(palette, 'needleSun', c.needles[2]);
    addNatural(palette, 'needleTip', c.needles[3]);
    if (c.snow) addNatural(palette, 'snow', '#f1f5f9');
    addNatural(palette, 'bark', '#5a4535');
    addNatural(palette, 'barkDeep', '#45342a');
    addNatural(palette, 'litter', '#7b5a3a');
    addNatural(palette, 'litterPale', '#957250');
    addNatural(palette, 'cone', '#6b4a2c');
    palette.addFamily('grass', '#26502e', '#4f8a43', '#b6d98a');
    addNatural(palette, 'bulb', '#ffd27a', true);
    addNatural(palette, 'star', '#ffd54a', true);
    const ground = addGroundFamilies(palette, {
      tileA: [c.tile[0], c.tile[1], c.tile[2]],
      tileB: ['#34413a', '#a3b0a8', '#dde8e0'],
      accent: ['#1d4a5e', '#8fb7c8', '#cfe6ef'],
    });
    return paletteSet(palette, ground);
  },
  build(grid, palette, ctx) {
    const { layout, seed, u, g } = ctx;
    const rng = mulberry32(seed);
    const c = layout.size / 2;
    const mid = (name: string): number => palette.tone(palette.id(name), 'mid');
    const SHADE = mid('needleShade');
    const NEEDLE = mid('needle');
    const SUN = mid('needleSun');
    const TIP = mid('needleTip');
    const BARK = mid('bark');
    const BARK_DEEP = mid('barkDeep');
    const BULB = mid('bulb');
    const STAR = mid('star');
    const settings = PINE_SETTINGS.get(palette) ?? PINE_COLORS.evergreen;

    const crownBase = g + 6.5 * u;
    const topY = g + 56 * u;
    const R0 = 13 * u;
    const radiusAt = (y: number): number => {
      const f = Math.min(1, Math.max(0, (y - crownBase) / (topY - crownBase)));
      return R0 * Math.pow(1 - f, 0.92) + 0.6 * u;
    };

    const bark: Chooser = (x, y, z) => (fbm3((x / u) * 0.6, (y / u) * 0.15, (z / u) * 0.6, seed + 1) > 0.56 ? BARK_DEEP : BARK);
    fillLathe(grid, c, c, g, topY - 1 * u, (t) => 0.35 * u + 1.55 * u * (1 - t), bark);
    const lobe = rng() * Math.PI * 2;
    fillBox(grid, c - 5 * u, g, c - 5 * u, c + 5 * u, g + 3 * u, c + 5 * u, (x, y, z) => {
      const dx = x + 0.5 - c;
      const dz = z + 0.5 - c;
      const h = y + 0.5 - g;
      const lobes = Math.pow(Math.max(0, Math.cos(5 * Math.atan2(dz, dx) + lobe)), 2);
      const r = 1.9 * u + 1.6 * u * Math.exp(-h / (0.9 * u)) * (0.4 + 0.6 * lobes);
      return dx * dx + dz * dz <= r * r ? bark(x, y, z) : 0;
    });

    const golden = Math.PI * (3 - Math.sqrt(5));
    let az = rng() * Math.PI * 2;
    let branchId = 0;
    const sprayBranch = (yb: number, angle: number, L: number): void => {
      const id = branchId++;
      const k = (yb - crownBase) / (topY - crownBase);
      const slope = -0.05 + 0.32 * k;
      const droop = 0.32 * (1 - k) + 0.06;
      const yAt = (t: number): number => yb + L * (slope * t - droop * t * t + 0.14 * Math.pow(t, 4));
      const tx = Math.cos(angle);
      const tz = Math.sin(angle);
      const W = Math.max(1.2 * u, settings.spray * L);
      const widths = new Float32Array(33);
      for (let i = 0; i <= 32; i++) {
        const t = i / 32;
        widths[i] = W * Math.sin(Math.PI * Math.min(1, t * 0.85 + 0.12)) * (0.75 + 0.4 * valueNoise3(t * L / u * 0.45, id, 0, seed + 7));
      }
      const thickAt = (t: number): number => 1.1 * u + 0.7 * u * (1 - t);
      fillCapsule(grid, c, yb, c, c + tx * L * 0.65, yAt(0.65), c + tz * L * 0.65, 0.6 * u, 0.35 * u, bark);
      const x0 = Math.floor(Math.min(c, c + tx * L) - W - 1);
      const x1 = Math.ceil(Math.max(c, c + tx * L) + W + 1);
      const z0 = Math.floor(Math.min(c, c + tz * L) - W - 1);
      const z1 = Math.ceil(Math.max(c, c + tz * L) + W + 1);
      const y0 = Math.floor(Math.min(yb, yAt(1), yAt(0.6)) - 3 * u - W * 0.45);
      const y1 = Math.ceil(Math.max(yb, yAt(1)) + 3 * u);
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) {
          for (let x = x0; x <= x1; x++) {
            const rx = x + 0.5 - c;
            const rz = z + 0.5 - c;
            const t = (rx * tx + rz * tz) / L;
            if (t < 0.04 || t > 1.04) continue;
            const tc = Math.min(1, t);
            const side = -rx * tz + rz * tx;
            const w = widths[Math.round(tc * 32)];
            const v = y + 0.5 - yAt(tc) + (0.45 * side * side) / W;
            const th = thickAt(tc);
            const tipRound = t > 0.94 ? (t - 0.94) * 14 : 0;
            const e = (side / w) ** 2 + (v / th) ** 2 + tipRound;
            if (e > 1.45) continue;
            if (e > 1 + (fbm3((x / u) * 0.7, (y / u) * 0.7, (z / u) * 0.7, seed + 6) - 0.5) * 0.9) continue;
            let material: number;
            if (t > 0.86 && v > -0.3 * th) material = TIP;
            else {
              const light = 0.5 + (v / th) * 0.4 + (t - 0.55) * 0.5 + (fbm3((x / u) * 0.3, (y / u) * 0.3, (z / u) * 0.3, seed + 4) - 0.5) * 0.6;
              material = light < 0.36 ? SHADE : light > 0.7 ? SUN : NEEDLE;
            }
            grid.set(x, y, z, material);
          }
        }
      }
    };
    const whorlGap = 2.4 * u;
    for (let yb = crownBase; yb < topY - 3 * u; yb += whorlGap) {
      const count = settings.branches + Math.floor(rng() * 2) - 1;
      const R = radiusAt(yb);
      for (let i = 0; i < count; i++) {
        sprayBranch(yb, az + (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.5, R * (0.75 + rng() * 0.4));
      }
      for (let i = 0; i < 2; i++) sprayBranch(yb + whorlGap / 2, az + rng() * Math.PI * 2, radiusAt(yb + whorlGap / 2) * 0.7);
      az += golden;
    }
    fillEllipsoid(grid, c, topY - 2.5 * u, c, 1.3 * u, 3 * u, 1.3 * u, (_x, y) => (y > topY - 2 * u ? TIP : NEEDLE));

    if (settings.snow) {
      const SNOW = mid('snow');
      const snowable = new Set([SHADE, NEEDLE, SUN, TIP]);
      const r = Math.ceil(R0 + 4 * u);
      for (let y = Math.floor(topY + 1 * u); y >= Math.floor(crownBase - 4 * u); y--) {
        for (let z = Math.floor(c - r); z <= Math.ceil(c + r); z++) {
          for (let x = Math.floor(c - r); x <= Math.ceil(c + r); x++) {
            if (!snowable.has(grid.get(x, y, z)) || grid.solid(x, y + 1, z)) continue;
            if (fbm3((x / u) * 0.35, (y / u) * 0.35, (z / u) * 0.35, seed + 13) > 0.36) grid.set(x, y, z, SNOW);
          }
        }
      }
    }

    const turns = 6;
    const lightBottom = crownBase + 1.5 * u;
    const lightTop = topY - 6 * u;
    const start = rng() * Math.PI * 2;
    const end = start + turns * Math.PI * 2;
    for (let theta = start; theta < end;) {
      const y = Math.round(lightBottom + ((theta - start) / (end - start)) * (lightTop - lightBottom));
      const R = radiusAt(y);
      const dx = Math.cos(theta);
      const dz = Math.sin(theta);
      let prev: [number, number] | null = null;
      for (let r = R + 4 * u; r > 1; r -= 0.5) {
        const x = Math.floor(c + dx * r);
        const z = Math.floor(c + dz * r);
        if (grid.solid(x, y, z)) {
          if (prev) grid.set(prev[0], y, prev[1], BULB);
          break;
        }
        prev = [x, z];
      }
      theta += (2.3 * u) / Math.max(R, 2 * u);
    }

    const starR = 2.4 * u;
    const sy = topY + starR * 0.9;
    const inStar = (a: number, b: number): boolean => {
      const r = Math.hypot(a, b);
      const ang = Math.atan2(b, a) + Math.PI / 2;
      const f = Math.abs(((ang / (Math.PI * 2 / 5)) % 1 + 1) % 1 - 0.5) * 2;
      return r <= starR * (0.45 + 0.55 * f);
    };
    const half = Math.max(0.5, 0.45 * u);
    fillBox(grid, c - starR, sy - starR, c - starR, c + starR, sy + starR, c + starR, (x, y, z) => {
      const ax = x + 0.5 - c;
      const ay = y + 0.5 - sy;
      const az2 = z + 0.5 - c;
      return (Math.abs(az2) <= half && inStar(ax, ay)) || (Math.abs(ax) <= half && inStar(az2, ay)) ? STAR : 0;
    });
    fillCapsule(grid, c, topY - 1 * u, c, c, sy - starR * 0.6, c, 0.4 * u, 0.4 * u, () => NEEDLE);

    scatterLitter(grid, ctx, [mid('litter'), mid('litterPale')], 0.24, c, c, 16 * u, seed + 21);
    const CONE = mid('cone');
    const coneLength = Math.max(2, Math.round(0.9 * u));
    for (let i = 0; i < 8; i++) {
      const a = rng() * Math.PI * 2;
      const r = (5 + rng() * 12) * u;
      const x = Math.floor(c + Math.cos(a) * r);
      const z = Math.floor(c + Math.sin(a) * r);
      const alongX = hash3(x, 0, z, seed) < 0.5;
      const cells: [number, number][] = [];
      for (let k = 0; k < coneLength; k++) cells.push(alongX ? [x + k, z] : [x, z + k]);
      if (cells.some(([cx, cz]) => grid.solid(cx, g, cz) || !grid.solid(cx, g - 1, cz))) continue;
      for (const [cx, cz] of cells) grid.set(cx, g, cz, CONE);
    }
    addGrass(grid, palette, ctx, { family: palette.id('grass'), density: 0.025, finderBoost: 0.3, maxHeight: Math.max(2, Math.round(1.6 * u)), seed: seed + 41 });
    addStones(grid, palette, ctx, palette.id('rock'), rng, 3);
  },
};

/* ==================== FLOWER ==================== */

interface FlowerColors {
  shade: string; petal: string; light: string; inner: string; heart: string;
}

const FLOWER_COLORS: Record<string, FlowerColors> = {
  pink: { shade: '#d95886', petal: '#ef7aa1', light: '#f7a9c4', inner: '#fbc6d8', heart: '#e6c24a' },
  red: { shade: '#a8141f', petal: '#d0202e', light: '#e8474f', inner: '#e85a5f', heart: '#1f1a14' },
  white: { shade: '#dfe3c8', petal: '#f3f0e6', light: '#ffffff', inner: '#fbf8ef', heart: '#d9c04a' },
};

const FLOWER_VARIANTS: ObjectVariant[] = [
  { id: 'pink', name: 'Pink tulips', color: '#ef7aa1' },
  { id: 'red', name: 'Red tulips', color: '#d0202e' },
  { id: 'white', name: 'White tulips', color: '#f3f0e6' },
];

export const flower: VoxelObject = {
  id: 'flower',
  name: 'Flower',
  description: 'Potted tulips in a terracotta pot.',
  category: 'nature',
  variants: FLOWER_VARIANTS,
  createPalette(variantId) {
    const c = FLOWER_COLORS[variantId] ?? FLOWER_COLORS.pink;
    const palette = new Palette();
    addNatural(palette, 'petalShade', c.shade);
    addNatural(palette, 'petal', c.petal);
    addNatural(palette, 'petalLight', c.light);
    addNatural(palette, 'petalInner', c.inner);
    addNatural(palette, 'heart', c.heart);
    addNatural(palette, 'stem', '#6f9a55');
    addNatural(palette, 'leaf', '#62875a');
    addNatural(palette, 'leafPale', '#7d9f6e');
    addNatural(palette, 'terracotta', '#b9653d');
    addNatural(palette, 'terracottaDeep', '#a4552f');
    addNatural(palette, 'soil', '#3d2b1f');
    addNatural(palette, 'soilDeep', '#2e2018');
    palette.addFamily('grass', '#2c5530', '#5f9a45', '#b6d98a');
    return paletteSet(palette, addGroundFamilies(palette, CATEGORY_GROUND.nature));
  },
  build(grid, palette, ctx) {
    const { layout, seed, u, g } = ctx;
    const rng = mulberry32(seed);
    const c = layout.size / 2;
    const mid = (name: string): number => palette.tone(palette.id(name), 'mid');
    const SHADE = mid('petalShade');
    const PETAL = mid('petal');
    const LIGHT = mid('petalLight');
    const INNER = mid('petalInner');
    const HEART = mid('heart');
    const STEM = mid('stem');
    const LEAF = mid('leaf');
    const LEAF_PALE = mid('leafPale');
    const TERRACOTTA = mid('terracotta');
    const TERRACOTTA_DEEP = mid('terracottaDeep');
    const SOIL = mid('soil');
    const SOIL_DEEP = mid('soilDeep');

    const clay: Chooser = (x, y, z) => (fbm3((x / u) * 0.18, (y / u) * 0.18, (z / u) * 0.18, seed + 2) > 0.58 ? TERRACOTTA_DEEP : TERRACOTTA);

    fillLathe(grid, c, c, g, g + 2 * u, (t) => (t < 0.5 ? 13.6 * u + t * 2 * u : [15 * u, 13.4 * u]), clay);

    const potBottom = g + 1 * u;
    const potTop = g + 21 * u;
    const rimBottom = potTop - 3.5 * u;
    const soilTop = potTop - 2 * u;
    const bodyR = (y: number): number => 10.8 * u + ((y - potBottom) / (potTop - potBottom)) * 3.2 * u;
    fillLathe(grid, c, c, potBottom, potTop, (_t, y) => {
      const yc = y + 0.5;
      const outer = yc >= rimBottom ? bodyR(rimBottom) + 1.3 * u : bodyR(yc);
      if (yc < soilTop) return outer;
      return [outer, bodyR(yc) - 1.3 * u];
    }, clay);
    fillLathe(grid, c, c, soilTop - 1.5 * u, soilTop, (t) => bodyR(soilTop) - 1.2 * u - (1 - t) * 0.5 * u, (x, y, z) =>
      fbm3((x / u) * 0.4, (y / u) * 0.4, (z / u) * 0.4, seed + 5) > 0.55 ? SOIL_DEEP : SOIL);

    const bulbs: { x: number; z: number; ring: number }[] = [{ x: c, z: c, ring: 0 }];
    const a0 = rng() * Math.PI * 2;
    for (let i = 0; i < 5; i++) {
      const a = a0 + (i / 5) * Math.PI * 2 + (rng() - 0.5) * 0.3;
      bulbs.push({ x: c + Math.cos(a) * 5 * u, z: c + Math.sin(a) * 5 * u, ring: 1 });
    }
    for (let i = 0; i < 3; i++) {
      const a = a0 + Math.PI / 5 + (i / 3) * Math.PI * 2 + (rng() - 0.5) * 0.3;
      bulbs.push({ x: c + Math.cos(a) * 9 * u, z: c + Math.sin(a) * 9 * u, ring: 2 });
    }

    const leafHalf = Math.max(0.5, 0.5 * u);
    for (const bulb of bulbs) {
      const out = bulb.ring === 0 ? rng() * Math.PI * 2 : Math.atan2(bulb.z - c, bulb.x - c);
      for (let k = 0; k < 2; k++) {
        const dir = out + (k === 0 ? -1 : 1) * (0.35 + rng() * 0.5);
        const L = (17 + rng() * 6) * u;
        const W = (2.1 + rng() * 0.6) * u;
        const dx = Math.cos(dir);
        const dz = Math.sin(dir);
        const steps = Math.ceil(L / (0.25 * u));
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const reach = L * 0.42 * t * t + L * 0.06 * t;
          const lift = L * 0.8 * Math.sin(t * Math.PI * 0.55) - L * 0.1 * t * t * t;
          const p: Point = { x: bulb.x + dx * reach, y: soilTop + lift, z: bulb.z + dz * reach };
          const hw = W * Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(t, 0.75))), 0.7);
          const curl = hw * 0.3;
          const sx = -dz * hw;
          const sz = dx * hw;
          const material = fbm3(p.x / u * 0.3, p.y / u * 0.3, p.z / u * 0.3, seed + 8) > 0.55 ? LEAF_PALE : LEAF;
          fillCapsule(grid, p.x - sx, p.y + curl, p.z - sz, p.x, p.y, p.z, leafHalf, leafHalf, () => material);
          fillCapsule(grid, p.x, p.y, p.z, p.x + sx, p.y + curl, p.z + sz, leafHalf, leafHalf, () => material);
        }
      }
    }

    const stemR = Math.max(0.75, 0.6 * u);
    for (const bulb of bulbs) {
      const out = bulb.ring === 0 ? rng() * Math.PI * 2 : Math.atan2(bulb.z - c, bulb.x - c);
      const lean = (0.8 + bulb.ring * 2.2 + rng()) * u;
      const height = (33 - bulb.ring * 3 - rng() * 3) * u;
      const top: Point = { x: bulb.x + Math.cos(out) * lean, y: soilTop + height, z: bulb.z + Math.sin(out) * lean };
      const segments = 6;
      let prev: Point = { x: bulb.x, y: soilTop - 1 * u, z: bulb.z };
      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const bend = t * t;
        const p: Point = { x: bulb.x + (top.x - bulb.x) * bend, y: soilTop - 1 * u + (top.y - soilTop + 1 * u) * t, z: bulb.z + (top.z - bulb.z) * bend };
        fillCapsule(grid, prev.x, prev.y, prev.z, p.x, p.y, p.z, stemR, stemR, () => STEM);
        prev = p;
      }

      const R = 2.9 * u;
      const H = 6.5 * u;
      const hb = top.y - 0.5 * u;
      const twist = rng() * Math.PI * 2;
      const wall = Math.max(1, 0.8 * u);
      fillLathe(grid, top.x, top.z, hb, hb + H, (t) => {
        const r = t < 0.3 ? R * Math.sqrt(1 - Math.pow((0.3 - t) / 0.3, 2)) : R * (1 - 0.16 * Math.pow((t - 0.3) / 0.7, 1.5));
        return t > 0.55 ? [r, r - wall] : r;
      }, (x, y, z) => {
        const t = (y + 0.5 - hb) / H;
        const dx = x + 0.5 - top.x;
        const dz = z + 0.5 - top.z;
        const d = Math.hypot(dx, dz);
        const phase = (((Math.atan2(dz, dx) + twist) / (Math.PI / 3)) % 1 + 1) % 1;
        const tipHeight = 0.8 + 0.2 * Math.sqrt(Math.max(0, 1 - Math.pow((phase - 0.5) * 2, 2)));
        if (t > tipHeight) return 0;
        if (t > 0.5 && t <= 0.56 && d < R - wall) return HEART;
        if (t > 0.55 && d < R - wall * 0.5) return INNER;
        return t < 0.22 ? SHADE : t > 0.72 ? LIGHT : PETAL;
      });
    }

    scatterLitter(grid, ctx, [PETAL, LIGHT], 0.05, c, c, 20 * u, seed + 21);
    addGrass(grid, palette, ctx, { family: palette.id('grass'), density: 0.03, finderBoost: 0.25, maxHeight: Math.max(2, Math.round(2.2 * u)), seed: seed + 41 });
    addStones(grid, palette, ctx, palette.id('rock'), rng, 2);
  },
};

