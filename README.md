# Voxel QR — 3D QR Code Generator

A fast, interactive 3D QR code generator that runs 100% in your browser.

Paste a link or text, choose a procedural design from 8 categories (36 voxel models) or convert your own photo into an embossed 3D relief. Tap the model: the camera arcs overhead, the lighting flattens, and the top surfaces resolve into a fully scannable QR code right off the screen.

---

## Quick Setup & Installation

### Prerequisites
- **Node.js** (v18.x or later recommended)
- **npm** (v9.x or later)

### Installation Steps

1. **Clone the repository & install dependencies**:
   ```bash
   git clone <repository-url>
   cd 3d-qr-generator
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

3. **Run unit & verification tests**:
   ```bash
   npm test
   ```
   Runs `vitest` suite, including `jsQR` scan verification checks for all 36 voxel objects.

4. **Build for production**:
   ```bash
   npm run build
   ```
   Runs TypeScript typechecking (`tsc`) and bundles production assets via Vite.

---

## Project Architecture

```
src/
├── core/qr/         # Pure QR code matrix generation & SVG export
├── voxel/           # Voxel grid, plot layout, color palette & top-voxel fit algorithm
├── objects/         # 36 procedural voxel models across 8 categories
│   ├── models/      # Category model definitions (business, education, food, medical, nature, sports, tech, vehicles)
│   ├── helpers/     # Shared model construction helpers (common, kit, vehicle-parts)
│   ├── categories.ts# Catalog category metadata
│   ├── types.ts     # Object interfaces & variant types
│   └── index.ts     # Main model registry & lookup helpers
├── render/          # Custom WebGL 2 / Canvas 2D renderer, mesher, lighting & timeline
│   └── shaders/     # Modular GLSL shaders (meshShader.ts, shadowShader.ts)
├── photo/           # Photo mode: QArt encoding, depth estimation, relief & ZXing scan tuning
├── ui/              # Main application UI coordinator & state management
│   └── components/  # Modular UI components (Topbar, Dock, SaveMenu, PhotoRow, SourceDialog, InfoDialog, ScanOverlay)
└── main.ts          # Application entry point
```

---

## How It Works

- **High Error Correction QR** – Built using `qrcode-generator` with Level H error correction (`src/core/qr`), ensuring up to 30% error recovery.
- **3D Ground Plot** – Ground tiles carry the code pattern; dark tiles sit 1 voxel lower so the QR structure creates physical 3D relief (`src/voxel/ground.ts`).
- **Top-Voxel Color Fitting** – The top visible voxel of each 3D column is recolored into the dark or light tone of its own material family matching the QR module underneath (`src/voxel/fit.ts`). The 3D model geometry remains intact!
- **Custom 3D Renderer** – Built from scratch without heavy frameworks. Uses an indexed WebGL 2 mesher (`src/render/WebGLRenderer.ts`) with baked ambient occlusion, directional sun shadow, and dynamic GLSL shaders (`src/render/shaders/`). Includes a 2D Canvas fallback (`src/render/CanvasRenderer.ts`).
- **Time of Day Engine** – 4 lighting environments (**Dawn**, **Day**, **Dusk**, **Night**) featuring dynamic sky gradients and emissive voxel light sources (lanterns, headlights, streetlamps).
- **Verified Scannable Badge** – After each render, the flat orthographic view is rendered off-screen and verified using `jsqr`. The badge only lights up green when verified.

---

## Photo Mode (QArt & Monocular Depth)

Upload any picture, drop an image, or paste a public link to create an embossed 3D relief:
- **AI Monocular Depth**: Downloads Depth Anything V2 (~27 MB ONNX model) once and caches it in browser storage. Includes a built-in algorithmic depth fallback.
- **QArt Matrix Steering**: Steers QR data codewords so dark/light modules naturally follow image luminance targets (`src/photo/qart.ts`).
- **Scan Strength Tuning**: Automatically selects the best balance between photo detail and scan reliability, verified via WebAssembly ZXing.

---

## Website Embedding

Build a model, click **Save → Copy embed code**, and paste the iframe snippet into any website:

```html
<iframe
  src="https://your-domain.com/?embed=1&amp;text=https%3A%2F%2Fexample.com&amp;o=cherry-tree&amp;v=blossom&amp;t=day"
  title="Interactive 3D QR code"
  width="480" height="480"
  style="border:0;width:100%;max-width:480px;aspect-ratio:1/1"
  loading="lazy"
  allow="fullscreen"
></iframe>
```

For full embed options and postMessage API specifications, view [docs/embedding.md](docs/embedding.md).

---

## Keyboard Shortcuts & Controls

| Action | Shortcut / Gesture |
|---|---|
| **Rotate Scene** | Drag mouse/touch or `Left` / `Right` Arrow keys |
| **Reveal / Hide QR** | Tap 3D Model, click **Reveal QR**, or press `Space` / `R` |
| **Cycle Time of Day** | Press `T` key |
| **Close Dialogs / Full-screen** | Press `Esc` key |

---

## Documentation & Project Guidelines

- **AI Guidelines & Rules**: See [`rules.md`](rules.md) for repository conventions, rendering guidelines, and engineering standards.
- **Product Requirements & PRD**: See [`plans/requirements.md`](plans/requirements.md) for full architecture specs, catalog listings, and technical requirements.
- **Embed Specs**: See [`docs/embedding.md`](docs/embedding.md) for iframe parameters and postMessage events.
