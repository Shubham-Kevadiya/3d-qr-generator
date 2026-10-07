import { VoxelGrid } from '../../voxel/grid';
import type { Palette } from '../../voxel/palette';
import { fillBox, fillCapsule, fillCylinderX, fillCylinderY, fillCylinderZ, fillEllipsoid, fillRoundedBox } from '../../voxel/shapes';
import { materialPalette } from '../helpers/kit';
import type { ObjectVariant, VoxelObject } from '../types';
import { curve, stampLeanX, wheelZ } from '../helpers/vehicle-parts';

type Grid = VoxelGrid;

function mid(palette: Palette, name: string): () => number {
  const material = palette.tone(palette.id(name), 'mid');
  return () => material;
}

function tube(grid: Grid, a: [number, number, number], b: [number, number, number], r: number, mat: () => number): void {
  const rr = Math.max(r, 0.72);
  fillCapsule(grid, a[0], a[1], a[2], b[0], b[1], b[2], rr, rr, mat);
}

function fillCylinderZ2(grid: Parameters<VoxelObject['build']>[0], cx: number, cy: number, za: number, zb: number, r: number, mat: number): void {
  const z0 = Math.min(za, zb);
  const z1 = Math.max(za, zb);
  for (let z = Math.floor(z0); z < Math.ceil(z1); z++) {
    for (let y = Math.floor(cy); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r && grid.get(x, y, z) === 0) grid.set(x, y, z, mat);
      }
    }
  }
}

/* ==================== SPORTS CAR ==================== */

const CAR_PAINTS: Record<string, string> = {
  red: '#b5121b',
  blue: '#1f4fa8',
  yellow: '#f0b400',
  white: '#e9ebef',
};

const CAR_VARIANTS: ObjectVariant[] = [
  { id: 'red', name: 'Racing red', color: CAR_PAINTS.red },
  { id: 'blue', name: 'Cobalt', color: CAR_PAINTS.blue },
  { id: 'yellow', name: 'Sun yellow', color: CAR_PAINTS.yellow },
  { id: 'white', name: 'Pearl', color: CAR_PAINTS.white },
];

const CAR_LENGTH = 4.5;
const CAR_HALF_WIDTH = 0.925;
const CAR_AXLES = [0.95, 3.6];
const CAR_WHEEL_R = 0.34;
const CAR_BELT = curve([[0, 0.5], [0.08, 0.78], [0.35, 0.86], [1.0, 0.9], [3.2, 0.9], [3.9, 0.8], [4.35, 0.7], [4.5, 0.5]]);
const CAR_SILL = curve([[0, 0.34], [0.25, 0.2], [4.15, 0.16], [4.5, 0.3]]);
const CAR_ROOF = curve([[0.95, 0.9], [1.95, 1.27], [2.55, 1.3], [3.25, 0.9]]);
const CAR_CABIN = [1.0, 3.22];

export const car: VoxelObject = {
  id: 'car',
  name: 'Sports Car',
  description: 'A fastback coupe on a lamp-lit plaza.',
  category: 'vehicles',
  variants: CAR_VARIANTS,
  createPalette(variantId) {
    return materialPalette('vehicles', {
      paint: CAR_PAINTS[variantId] ?? CAR_PAINTS.red,
      trim: '#16171a',
      rubber: '#1b1c1f',
      alloy: '#b9c0c9',
      chrome: '#d9dee5',
      glass: '#24384a',
      cabin: '#0d1013',
      lamp: { hex: '#fff3c8', glow: true },
      tail: { hex: '#e3101f', glow: true },
      amber: { hex: '#ff9a1a', glow: true },
      plate: '#f2f2ee',
      cone: '#ff6a10',
      reflect: '#f4f4f4',
      pole: '#2b2e33',
    });
  },
  build(grid, palette, { layout, u, g }) {
    const c = layout.size / 2;
    const k = 10.6 * u;
    const m = (name: string): number => palette.tone(palette.id(name), 'mid');
    const PAINT = m('paint');
    const TRIM = m('trim');
    const GLASS = m('glass');
    const CABIN_DARK = m('cabin');
    const LAMP = m('lamp');
    const TAIL = m('tail');
    const AMBER = m('amber');
    const CHROME = m('chrome');
    const PLATE = m('plate');
    const x0 = c - (CAR_LENGTH * k) / 2;
    const between = (v: number, a: number, b: number): boolean => v >= a && v < b;

    for (let y = g; y < g + Math.ceil(1.4 * k); y++) {
      for (let z = Math.floor(c - CAR_HALF_WIDTH * k - 2); z <= Math.ceil(c + CAR_HALF_WIDTH * k + 2); z++) {
        for (let x = Math.floor(x0 - 1); x <= Math.ceil(x0 + CAR_LENGTH * k + 1); x++) {
          const mx = (x + 0.5 - x0) / k;
          const my = (y + 0.5 - g) / k;
          const mz = Math.abs(z + 0.5 - c) / k;
          if (mx < 0 || mx > CAR_LENGTH) continue;

          const arch = CAR_AXLES.some((ax) => Math.hypot(mx - ax, my - CAR_WHEEL_R) < CAR_WHEEL_R + 0.07 && mz > 0.5);
          if (arch) continue;

          const belt = CAR_BELT(mx);
          const sill = CAR_SILL(mx);
          const end = Math.min(mx, CAR_LENGTH - mx);
          const R = 0.45;
          let half = CAR_HALF_WIDTH - (end < R ? R - Math.sqrt(R * R - (R - end) * (R - end)) : 0);
          if (my < 0.32) half -= (0.32 - my) * 0.6;
          if (my > belt - 0.14) half -= (my - (belt - 0.14)) * 1.3;

          let mat = 0;
          if (my >= sill && my < belt && mz <= half) {
            mat = PAINT;
            const skin = mz > half - 0.06;
            if (my < sill + 0.07) mat = TRIM;
            if (mx > 4.36 && between(my, 0.22, 0.43) && mz < 0.62) mat = TRIM;
            if (mx > 4.3 && between(my, 0.6, 0.7) && between(mz, 0.42, 0.8)) mat = LAMP;
            if (mx > 4.4 && between(my, 0.3, 0.36) && between(mz, 0.66, 0.78)) mat = AMBER;
            if (mx < 0.1 && between(my, 0.68, 0.76) && mz < 0.84) mat = TAIL;
            if (mx < 0.12 && between(my, 0.42, 0.55) && mz < 0.26) mat = PLATE;
            if (mx < 0.3 && my < 0.3 && mz < 0.75) mat = TRIM;
            if (skin && between(my, 0.3, belt - 0.04)) {
              if (Math.abs(mx - 1.62) < 0.025 || Math.abs(mx - 2.98) < 0.025) mat = TRIM;
              if (between(mx, 1.72, 1.86) && between(my, 0.78, 0.82)) mat = CHROME;
              if (between(mx, 1.35, 1.55) && between(my, 0.42, 0.6)) mat = TRIM;
            }
          } else if (between(mx, CAR_CABIN[0], CAR_CABIN[1]) && my >= belt && my < CAR_ROOF(mx)) {
            const roof = CAR_ROOF(mx);
            const cabinHalf = 0.74 - (my - belt) * 0.42 - Math.max(0, mx - 2.95) * 0.5;
            if (mz > cabinHalf) continue;
            mat = PAINT;
            const sideGlass = mz > cabinHalf - 0.06 && between(my, belt + 0.04, roof - 0.07)
              && between(mx, 1.35, 3.0) && Math.abs(mx - 2.1) > 0.04;
            const sloped = my > roof - 0.09 && mz < cabinHalf - 0.07;
            const windshield = sloped && mx > 2.6;
            const rearGlass = sloped && mx < 1.92 && mx > 1.08;
            if (sideGlass || windshield || rearGlass) mat = GLASS;
            if (mz < cabinHalf - 0.12 && my < roof - 0.12) mat = CABIN_DARK;
          }
          if (mat) grid.set(x, y, z, mat);
        }
      }
    }

    const wheelMats = { tire: m('rubber'), rim: m('alloy'), dark: TRIM };
    for (const ax of CAR_AXLES) {
      const wx = x0 + ax * k;
      for (const s of [-1, 1] as const) {
        fillCylinderZ2(grid, wx, g + CAR_WHEEL_R * k, c + s * 0.52 * k, c + s * 0.58 * k, (CAR_WHEEL_R + 0.07) * k, TRIM);
        wheelZ(grid, wheelMats, wx, g + CAR_WHEEL_R * k, c + s * 0.9 * k, s > 0 ? -1 : 1, CAR_WHEEL_R * k, 0.25 * k, 0.24 * k);
      }
    }
    for (const s of [-1, 1] as const) {
      const zIn = c + s * 0.68 * k;
      const zOut = c + s * 0.98 * k;
      fillRoundedBox(grid, x0 + 3.0 * k, g + 0.93 * k, Math.min(zIn, zOut), x0 + 3.16 * k, g + 1.05 * k, Math.max(zIn, zOut), 0.04 * k, () => PAINT);
      fillCylinderX(grid, g + 0.24 * k, c + s * 0.48 * k, x0 - 0.05 * k, x0 + 0.2 * k, 0.05 * k + 0.5, () => CHROME);
    }

    const CONE = m('cone');
    const REFLECT = m('reflect');
    for (const [sx, sz] of [[28, 22], [30, 9]]) {
      const cx = c + sx * u;
      const cz = c + sz * u;
      fillBox(grid, cx - 2.2 * u, g, cz - 2.2 * u, cx + 2.2 * u, g + 0.6 * u, cz + 2.2 * u, () => TRIM);
      const h = 7.4 * u;
      for (let y = Math.floor(g + 0.6 * u); y < g + h; y++) {
        const t = (y + 0.5 - g) / h;
        const band = between(t, 0.45, 0.62);
        fillCylinderY(grid, cx, cz, y, y + 1, (1.7 - t * 1.25) * u, () => (band ? REFLECT : CONE));
      }
    }
    const POLE = m('pole');
    const lampX = c + 27 * u;
    const lampZ = c + 30 * u;
    fillCylinderY(grid, lampX, lampZ, g, g + 1.5 * u, 1.6 * u, () => POLE);
    fillCylinderY(grid, lampX, lampZ, g, g + 42 * u, 0.75 * u, () => POLE);
    fillBox(grid, lampX - 7 * u, g + 41 * u, lampZ - 0.6 * u, lampX + 0.5 * u, g + 42.2 * u, lampZ + 0.6 * u, () => POLE);
    fillRoundedBox(grid, lampX - 9 * u, g + 40.2 * u, lampZ - 1.6 * u, lampX - 4.5 * u, g + 42.2 * u, lampZ + 1.6 * u, 0.5 * u, () => POLE);
    fillBox(grid, lampX - 8.6 * u, g + 39.8 * u, lampZ - 1.2 * u, lampX - 4.9 * u, g + 40.6 * u, lampZ + 1.2 * u, () => LAMP);
  },
};

/* ==================== BICYCLE ==================== */

const BICYCLE_VARIANTS: ObjectVariant[] = [
  { id: 'red', name: 'Red', color: '#c0161f' },
  { id: 'blue', name: 'Blue', color: '#1d57b8' },
  { id: 'green', name: 'Green', color: '#1f7a3a' },
];
const BICYCLE_PAINT: Record<string, string> = { red: '#c0161f', blue: '#1d57b8', green: '#1f7a3a' };

export const bicycle: VoxelObject = {
  id: 'bicycle',
  name: 'Bicycle',
  description: 'A trekking bike parked on its kickstand.',
  category: 'vehicles',
  variants: BICYCLE_VARIANTS,
  createPalette(variantId) {
    return materialPalette('vehicles', {
      frame: BICYCLE_PAINT[variantId] ?? BICYCLE_PAINT.red,
      tire: '#1c1d20',
      rim: '#c3c8cf',
      spoke: '#9aa1aa',
      steel: '#5d636b',
      black: '#141518',
      saddle: '#2a2420',
      lamp: { hex: '#fff3c8', glow: true },
      reflector: { hex: '#e3101f', glow: true },
    });
  },
  build(grid, palette, { layout, u, g }) {
    const c = layout.size / 2;
    const k = 25 * u;
    const local = new VoxelGrid(grid.width, grid.height, grid.depth);
    const x0 = c - (1.07 * k) / 2;
    const P = (mx: number, my: number, mz = 0): [number, number, number] => [x0 + mx * k, g + my * k, c + mz * k];
    const FRAME = mid(palette, 'frame');
    const STEEL = mid(palette, 'steel');
    const BLACK = mid(palette, 'black');
    const tubeR = 0.022 * k;

    const TIRE = palette.tone(palette.id('tire'), 'mid');
    const RIM = palette.tone(palette.id('rim'), 'mid');
    const SPOKE = palette.tone(palette.id('spoke'), 'mid');
    const R = 0.35 * k;
    const rimR = 0.31 * k;
    for (const hx of [0, 1.07]) {
      const [wx, wy] = P(hx, 0.35);
      const halfW = Math.max(0.9, 0.022 * k);
      for (let z = Math.floor(c - halfW); z < Math.ceil(c + halfW); z++) {
        for (let y = Math.floor(wy - R); y <= Math.ceil(wy + R); y++) {
          for (let x = Math.floor(wx - R); x <= Math.ceil(wx + R); x++) {
            const dx = x + 0.5 - wx;
            const dy = y + 0.5 - wy;
            const d = Math.hypot(dx, dy);
            if (d > R) continue;
            if (d > rimR) local.set(x, y, z, TIRE);
            else if (d > rimR - Math.max(1, 0.025 * k)) local.set(x, y, z, RIM);
          }
        }
      }
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const zs = c + (i % 2 ? 0.3 : -0.3);
        for (let t = 0.06 * k; t < rimR - 0.5; t += 0.5) {
          local.set(Math.floor(wx + Math.cos(a) * t), Math.floor(wy + Math.sin(a) * t), Math.floor(zs), SPOKE);
        }
      }
      fillCylinderZ(local, wx, wy, c - 0.06 * k, c + 0.06 * k, Math.max(1, 0.025 * k), STEEL);
    }

    const bb = P(0.43, 0.29);
    const seatTop = P(0.28, 0.8);
    const headTop = P(0.915, 0.86);
    const headLow = P(0.965, 0.71);
    tube(local, bb, seatTop, tubeR * 1.1, FRAME);
    tube(local, seatTop, headTop, tubeR, FRAME);
    tube(local, bb, headLow, tubeR * 1.3, FRAME);
    tube(local, headTop, headLow, tubeR * 1.4, FRAME);
    for (const s of [-1, 1]) {
      tube(local, bb, P(0, 0.35, s * 0.06), tubeR * 0.8, FRAME);
      tube(local, P(0.29, 0.77, s * 0.02), P(0, 0.35, s * 0.06), tubeR * 0.75, FRAME);
      tube(local, P(0.965, 0.7, s * 0.05), P(1.07, 0.35, s * 0.05), tubeR * 0.8, STEEL);
    }
    tube(local, seatTop, P(0.235, 0.94), tubeR * 0.7, STEEL);
    fillRoundedBox(local, x0 + 0.1 * k, g + 0.94 * k, c - 0.075 * k, x0 + 0.27 * k, g + 0.99 * k, c + 0.075 * k, 0.02 * k, mid(palette, 'saddle'));
    fillRoundedBox(local, x0 + 0.27 * k, g + 0.95 * k, c - 0.03 * k, x0 + 0.37 * k, g + 0.99 * k, c + 0.03 * k, 0.015 * k, mid(palette, 'saddle'));
    tube(local, headTop, P(0.97, 0.94), tubeR * 0.8, STEEL);
    tube(local, P(0.97, 0.94, -0.3), P(0.97, 0.94, 0.3), tubeR * 0.7, STEEL);
    for (const s of [-1, 1]) tube(local, P(0.97, 0.94, s * 0.2), P(0.97, 0.94, s * 0.31), tubeR * 1.1, BLACK);
    tube(local, P(0.96, 0.72), P(1.0, 0.73), tubeR * 0.5, STEEL);
    fillRoundedBox(local, x0 + 0.99 * k, g + 0.7 * k, c - 0.03 * k, x0 + 1.05 * k, g + 0.76 * k, c + 0.03 * k, 0.01 * k, mid(palette, 'lamp'));
    fillBox(local, x0 + 0.2 * k, g + 0.85 * k, c - 0.025 * k, x0 + 0.24 * k, g + 0.9 * k, c + 0.025 * k, mid(palette, 'reflector'));

    const ringZ = 0.075;
    fillCylinderZ(local, bb[0], bb[1], c + (ringZ - 0.01) * k, c + (ringZ + 0.01) * k, 0.1 * k, STEEL, 0.06 * k);
    fillCylinderZ(local, x0, g + 0.35 * k, c + (ringZ - 0.01) * k, c + (ringZ + 0.01) * k, 0.045 * k, STEEL);
    tube(local, P(0.43, 0.39, ringZ), P(0, 0.395, ringZ), 0.008 * k, BLACK);
    tube(local, P(0.43, 0.19, ringZ), P(0, 0.305, ringZ), 0.008 * k, BLACK);
    tube(local, P(0.43, 0.29, ringZ + 0.03), P(0.53, 0.15, ringZ + 0.03), tubeR * 0.7, STEEL);
    tube(local, P(0.43, 0.29, -ringZ - 0.03), P(0.33, 0.43, -ringZ - 0.03), tubeR * 0.7, STEEL);
    fillRoundedBox(local, x0 + 0.49 * k, g + 0.13 * k, c + 0.11 * k, x0 + 0.58 * k, g + 0.16 * k, c + 0.2 * k, 0.01 * k, BLACK);
    fillRoundedBox(local, x0 + 0.29 * k, g + 0.41 * k, c - 0.2 * k, x0 + 0.38 * k, g + 0.44 * k, c - 0.11 * k, 0.01 * k, BLACK);

    const lean = (7 * Math.PI) / 180;
    stampLeanX(grid, local, g, c, lean);
    const pivot = (mx: number, my: number, mz: number): [number, number, number] => {
      const ly = my * k;
      const lz = mz * k;
      return [x0 + mx * k, g + lz * Math.sin(lean) + ly * Math.cos(lean), c + lz * Math.cos(lean) - ly * Math.sin(lean)];
    };
    const mount = pivot(0.36, 0.3, -0.03);
    const foot: [number, number, number] = [x0 + 0.26 * k, g + 0.4, c - 0.17 * k];
    tube(grid, mount, foot, tubeR * 0.8, STEEL);
    fillRoundedBox(grid, foot[0] - 0.03 * k, g, foot[2] - 0.03 * k, foot[0] + 0.03 * k, g + Math.max(1, 0.015 * k), foot[2] + 0.03 * k, 0.01 * k, STEEL);
  },
};

/* ==================== AIRPLANE ==================== */

const AIRPLANE_VARIANTS: ObjectVariant[] = [
  { id: 'white', name: 'Navy tail', color: '#1b2f5c' },
  { id: 'blue', name: 'Sky blue', color: '#1f64c8' },
  { id: 'teal', name: 'Teal', color: '#127c7c' },
];
const AIRPLANE_LIVERY: Record<string, string> = { white: '#1b2f5c', blue: '#1f64c8', teal: '#127c7c' };

export const airplane: VoxelObject = {
  id: 'airplane',
  name: 'Airplane',
  description: 'A narrow-body jetliner parked on its landing gear.',
  category: 'vehicles',
  variants: AIRPLANE_VARIANTS,
  createPalette(variantId) {
    return materialPalette('vehicles', {
      body: '#eef0f3',
      livery: AIRPLANE_LIVERY[variantId] ?? AIRPLANE_LIVERY.white,
      belly: '#c9ced6',
      window: '#1d2733',
      metal: '#a7adb6',
      fan: '#2a2e35',
      gear: '#6e747c',
      tire: '#1b1c1f',
      navRed: { hex: '#ff2a2a', glow: true },
      navGreen: { hex: '#2aff6a', glow: true },
      strobe: { hex: '#ffffff', glow: true },
    });
  },
  build(grid, palette, { layout, u, g }) {
    const c = layout.size / 2;
    const k = 1.3 * u;
    const LEN = 37.6;
    const x0 = c - (LEN * k) / 2 + 0.8 * k;
    const BODY = palette.tone(palette.id('body'), 'mid');
    const LIV = palette.tone(palette.id('livery'), 'mid');
    const BELLY = palette.tone(palette.id('belly'), 'mid');
    const WINDOW = palette.tone(palette.id('window'), 'mid');
    const METAL = mid(palette, 'metal');
    const GEAR = mid(palette, 'gear');
    const TIRE = mid(palette, 'tire');
    const minT = 1.05;
    const cy = 3.6;
    const top = curve([[0, 5.15], [3, 5.4], [11, 5.58], [33, 5.58], [35.2, 5.3], [36.8, 4.4], [37.6, 3.5]]);
    const bottom = curve([[0, 4.55], [5, 3.6], [11, 1.62], [33.5, 1.62], [36.2, 2.15], [37.6, 3.1]]);
    for (let y = g; y < g + 6 * k; y++) {
      for (let z = Math.floor(c - 2.2 * k); z <= Math.ceil(c + 2.2 * k); z++) {
        for (let x = Math.floor(x0); x < x0 + LEN * k; x++) {
          const mx = (x + 0.5 - x0) / k;
          const my = (y + 0.5 - g) / k;
          const mz = (z + 0.5 - c) / k;
          const t = top(mx);
          const b = bottom(mx);
          const ry = (t - b) / 2;
          const yc = (t + b) / 2;
          const rz = Math.min(1.98, ry);
          const e = ((my - yc) / ry) ** 2 + (mz / rz) ** 2;
          if (e > 1) continue;
          let mat = my < yc - ry * 0.45 ? BELLY : BODY;
          const skin = e > 0.72;
          if (skin && Math.abs(mz) > 1.2) {
            if (mx > 7 && mx < 32 && Math.abs(my - (cy + 0.55)) < 0.28 && (x & 1) === 0) mat = WINDOW;
            if (mx > 8 && mx < 34 && Math.abs(my - (cy - 0.15)) < 0.22) mat = LIV;
          }
          if (skin && mx > 34.6 && mx < 36.1 && my > yc + 0.25 && my < yc + 0.95) mat = WINDOW;
          if (mx < 1.2) mat = METAL();
          grid.set(x, y, z, mat);
        }
      }
    }
    const span = 17.9;
    for (let z = Math.floor(c - span * k); z <= Math.ceil(c + span * k); z++) {
      const s = Math.abs(z + 0.5 - c) / k;
      if (s < 1.6) continue;
      const q = Math.min(1, s / span);
      const le = 21 - s * Math.tan((25 * Math.PI) / 180);
      const chord = 6.6 - q * 5.1;
      const midY = 2.3 + s * 0.087;
      const thick = Math.max(minT / k, 0.62 - q * 0.42);
      for (let x = Math.floor(x0 + (le - chord) * k); x <= Math.ceil(x0 + le * k); x++) {
        for (let y = Math.floor(g + (midY - thick / 2) * k); y < g + (midY + thick / 2) * k; y++) {
          const mx = (x + 0.5 - x0) / k;
          if (mx > le || mx < le - chord) continue;
          grid.set(x, y, z, s > span - 0.6 ? LIV : BODY);
        }
      }
      if (s > span - 0.5) {
        for (let y = Math.floor(g + midY * k); y < g + (midY + 2.4) * k; y++) {
          const h = (y + 0.5 - g) / k - midY;
          for (let x = Math.floor(x0 + (le - 1.4 - h * 0.5) * k); x < x0 + (le - h * 0.6) * k; x++) grid.set(x, y, z, LIV);
        }
      }
    }
    for (let z = Math.floor(c - 6.2 * k); z <= Math.ceil(c + 6.2 * k); z++) {
      const s = Math.abs(z + 0.5 - c) / k;
      const le = 6.4 - s * 0.55;
      const chord = 3.6 - (s / 6.2) * 2.2;
      for (let x = Math.floor(x0 + (le - chord) * k); x < x0 + le * k; x++) {
        for (let y = Math.floor(g + 4.9 * k); y < g + 4.9 * k + Math.max(minT, 0.35 * k); y++) grid.set(x, y, z, BODY);
      }
    }
    for (let y = Math.floor(g + 5 * k); y < g + 11.8 * k; y++) {
      const h = (y + 0.5 - g) / k - 5.2;
      const le = 8.2 - h * 1.0;
      const chord = 6.2 - h * 0.62;
      const half = Math.max(minT / 2, (0.22 - h * 0.015) * k);
      fillBox(grid, x0 + (le - chord) * k, y, c - half, x0 + le * k, y + 1, c + half, () => LIV);
    }
    for (const sz of [-1, 1]) {
      const ez = c + sz * 5.75 * k;
      const ey = g + 1.6 * k;
      const front = x0 + 22.6 * k;
      const back = x0 + 18.0 * k;
      fillCylinderX(grid, ey, ez, back, front, 1.05 * k, () => LIV);
      fillCylinderX(grid, ey, ez, front - Math.max(1, 0.3 * k), front, 1.05 * k, METAL);
      fillCylinderX(grid, ey, ez, front - Math.max(1, 0.3 * k), front + 0.2, 0.82 * k, mid(palette, 'fan'));
      fillCylinderX(grid, ey, ez, back - 1.2 * k, back, 0.6 * k, METAL);
      fillBox(grid, back + 0.6 * k, ey + 0.7 * k, ez - Math.max(0.6, 0.18 * k), front - 1.3 * k, g + 2.75 * k, ez + Math.max(0.6, 0.18 * k), () => BODY);
    }
    const gearLeg = (gx: number, gz: number, topY: number, wheelR: number, spread: number): void => {
      const wy = g + wheelR * k;
      tube(grid, [gx, wy, gz], [gx, g + topY * k, gz], 0.13 * k, GEAR);
      for (const s of [-1, 1]) {
        const zc = gz + s * spread * k;
        fillCylinderZ(grid, gx, wy, zc - Math.max(0.7, 0.18 * k), zc + Math.max(0.7, 0.18 * k), wheelR * k, TIRE);
      }
      tube(grid, [gx, wy, gz - spread * k], [gx, wy, gz + spread * k], 0.07 * k, GEAR);
    };
    gearLeg(x0 + 32.4 * k, c, 1.8, 0.38, 0.28);
    for (const sz of [-1, 1]) gearLeg(x0 + 15.6 * k, c + sz * 3.8 * k, 2.45, 0.57, 0.45);

    const light = (lx: number, ly: number, lz: number, name: string): void =>
      fillBox(grid, lx - 0.5, ly - 0.5, lz - 0.5, lx + 0.5, ly + 0.5, lz + 0.5, mid(palette, name));
    const tipX = x0 + (21 - span * Math.tan((25 * Math.PI) / 180) - 0.8) * k;
    light(tipX, g + (2.3 + span * 0.087) * k, c - span * k, 'navRed');
    light(tipX, g + (2.3 + span * 0.087) * k, c + span * k - 1, 'navGreen');
    light(x0 + 0.2 * k, g + 4.8 * k, c, 'strobe');
  },
};

/* ==================== TRUCK ==================== */

const TRUCK_VARIANTS: ObjectVariant[] = [
  { id: 'blue', name: 'Blue', color: '#1f4fa8' },
  { id: 'red', name: 'Red', color: '#b5121b' },
  { id: 'orange', name: 'Orange', color: '#f06a10' },
];
const TRUCK_CAB_PAINT: Record<string, string> = { blue: '#1f4fa8', red: '#b5121b', orange: '#f06a10' };

export const truck: VoxelObject = {
  id: 'truck',
  name: 'Truck',
  description: 'A cab-over box truck with a roll-up rear door.',
  category: 'vehicles',
  variants: TRUCK_VARIANTS,
  createPalette(variantId) {
    return materialPalette('vehicles', {
      cab: TRUCK_CAB_PAINT[variantId] ?? TRUCK_CAB_PAINT.blue,
      box: '#e8eaed',
      rail: '#a9b0b9',
      chassis: '#1a1b1e',
      tire: '#1b1c1f',
      rim: '#b9c0c9',
      glass: '#24384a',
      grille: '#2b2e33',
      chrome: '#d9dee5',
      lamp: { hex: '#fff3c8', glow: true },
      amber: { hex: '#ff9a1a', glow: true },
      tail: { hex: '#e3101f', glow: true },
    });
  },
  build(grid, palette, { layout, u, g }) {
    const c = layout.size / 2;
    const k = 6.3 * u;
    const x0 = c - (7.6 * k) / 2;
    const X = (m: number): number => x0 + m * k;
    const Y = (m: number): number => g + m * k;
    const Z = (m: number): number => c + m * k;
    const CAB = mid(palette, 'cab');
    const BOX = palette.tone(palette.id('box'), 'mid');
    const RAIL = palette.tone(palette.id('rail'), 'mid');
    const CHASSIS = mid(palette, 'chassis');
    const GLASS = mid(palette, 'glass');
    const GRILLE = mid(palette, 'grille');
    const CHROME = mid(palette, 'chrome');
    const AMBER = mid(palette, 'amber');
    const TAIL = mid(palette, 'tail');
    const LAMP = mid(palette, 'lamp');
    const thin = Math.max(1, 0.06 * k);

    for (const s of [-1, 1]) fillBox(grid, X(0.25), Y(0.62), Z(s * 0.48 - 0.1), X(7.2), Y(0.86), Z(s * 0.48 + 0.1), CHASSIS);
    fillBox(grid, X(0.1), Y(0.42), Z(-1.1), X(0.2), Y(0.56), Z(1.1), CHASSIS);
    for (const s of [-1, 1]) fillBox(grid, X(0.2), Y(0.45), Z(s * 0.9 - 0.04), X(0.3), Y(0.86), Z(s * 0.9 + 0.04), CHASSIS);

    fillBox(grid, X(0.15), Y(0.9), Z(-1.2), X(5.3), Y(3.5), Z(1.2), (x, y, z) => {
      const mx = (x + 0.5 - x0) / k;
      const my = (y + 0.5 - g) / k;
      const mz = Math.abs(z + 0.5 - c) / k;
      if (my < 1.04 || my > 3.38) return RAIL;
      if ((mx < 0.27 || mx > 5.18) && mz > 1.08) return RAIL;
      if (mx < 0.2 && mz < 1.06) return Math.floor(((y + 0.5 - g) / k) / 0.22) % 2 === 0 ? BOX : RAIL;
      if (mz > 1.17 && Math.abs(((mx - 0.27) % 0.61) - 0.3) < 0.025) return RAIL;
      return BOX;
    });
    fillBox(grid, X(0.08), Y(0.98), Z(-0.6), X(0.16), Y(1.06), Z(0.6), CHROME);
    for (const s of [-1, 1]) {
      fillBox(grid, X(0.08), Y(1.2), Z(s * 1.05 - 0.1), X(0.16), Y(1.45), Z(s * 1.05 + 0.1), TAIL);
      for (const mx of [0.3, 5.15]) fillBox(grid, X(mx), Y(3.42), Z(s * 1.2 - 0.04) - 0.5, X(mx + 0.14), Y(3.5), Z(s * 1.2 + 0.04) + 0.5, AMBER);
    }

    fillBox(grid, X(5.45), Y(0.55), Z(-1.05), X(7.55), Y(2.75), Z(1.05), (x, y, z) => {
      const mx = (x + 0.5 - x0) / k;
      const my = (y + 0.5 - g) / k;
      const mz = Math.abs(z + 0.5 - c) / k;
      const front = 7.55 - Math.max(0, my - 1.6) * 0.22;
      if (mx > front) return 0;
      const R = 0.18;
      const ex = Math.max(0, mx - (front - R));
      const ez = Math.max(0, mz - (1.05 - R));
      if (ex * ex + ez * ez > R * R) return 0;
      const window = my > 1.65 && my < 2.55;
      if (window && mx > front - 0.1 && mz < 0.95) return palette.tone(palette.id('glass'), 'mid');
      if (window && mz > 0.98 && mx > 6.2 && mx < 7.25) return palette.tone(palette.id('glass'), 'mid');
      if (mz > 0.99 && (Math.abs(mx - 6.12) < 0.03 || (my < 1.62 && my > 1.58 && mx > 6.12))) return palette.tone(palette.id('grille'), 'mid');
      return palette.tone(palette.id('cab'), 'mid');
    });
    fillRoundedBox(grid, X(5.5), Y(2.7), Z(-1.0), X(7.2), Y(2.95), Z(1.0), 0.1 * k, CAB);
    fillBox(grid, X(7.48), Y(0.95), Z(-0.6), X(7.6), Y(1.4), Z(0.6), GRILLE);
    for (let y = Math.floor(Y(0.98)); y < Y(1.4); y += 2) fillBox(grid, X(7.56), y, Z(-0.58), X(7.62), y + 1, Z(0.58), CHROME);
    fillBox(grid, X(7.45), Y(0.35), Z(-1.1), X(7.68), Y(0.65), Z(1.1), CHROME);
    for (const s of [-1, 1]) {
      fillBox(grid, X(7.5), Y(0.98), Z(s * 0.82 - 0.16), X(7.6), Y(1.25), Z(s * 0.82 + 0.16), LAMP);
      fillBox(grid, X(7.5), Y(1.28), Z(s * 0.82 - 0.16), X(7.6), Y(1.38), Z(s * 0.82 + 0.16), AMBER);
      const mz = Z(s * 1.32);
      tube(grid, [X(7.2), Y(2.2), Z(s * 1.02)], [X(7.25), Y(2.2), mz], 0.03 * k, CHROME);
      fillBox(grid, X(7.15), Y(1.75), Math.min(mz, mz + s * thin), X(7.3), Y(2.35), Math.max(mz, mz + s * thin) + 0.5, GRILLE);
      fillBox(grid, X(6.4), Y(0.42), Z(s * 1.0 - 0.12), X(7.0), Y(0.48) + 0.5, Z(s * 1.0 + 0.12), CHASSIS);
      if (s < 0) fillCylinderX(grid, Y(0.72), Z(-0.85), X(3.9), X(5.0), 0.3 * k, () => palette.tone(palette.id('chrome'), 'mid'));
      else fillBox(grid, X(4.2), Y(0.5), Z(0.6), X(4.9), Y(0.95), Z(1.05), CHASSIS);
    }
    for (const mz of [-0.5, -0.25, 0, 0.25, 0.5]) fillBox(grid, X(6.9), Y(2.95), Z(mz) - 0.6, X(7.05), Y(2.95) + thin, Z(mz) + 0.6, AMBER);

    const wheelMats = { tire: palette.tone(palette.id('tire'), 'mid'), rim: palette.tone(palette.id('rim'), 'mid'), dark: palette.tone(palette.id('chassis'), 'mid') };
    const r = 0.45 * k;
    for (const s of [-1, 1] as const) {
      wheelZ(grid, wheelMats, X(6.55), Y(0.45), Z(s * 1.08), s > 0 ? -1 : 1, r, 0.28 * k, 0.28 * k, 8);
      wheelZ(grid, wheelMats, X(2.2), Y(0.45), Z(s * 1.12), s > 0 ? -1 : 1, r, 0.27 * k, 0.28 * k, 8);
      fillCylinderZ(grid, X(2.2), Y(0.45), Math.min(Z(s * 0.84), Z(s * 0.58)), Math.max(Z(s * 0.84), Z(s * 0.58)), r, CHASSIS);
      fillBox(grid, X(1.55), Y(0.12), Z(s * 1.0 - 0.02) - 0.5, X(1.6) + 0.5, Y(0.88), Z(s * 1.0 + 0.02) + 0.5, CHASSIS);
      fillEllipsoid(grid, X(6.55), Y(0.95), Z(s * 1.02), 0.5 * k, 0.12 * k, 0.08 * k, CHASSIS);
    }
  },
};

