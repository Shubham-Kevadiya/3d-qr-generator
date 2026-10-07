# Voxel QR — AI Rules & Project Guidelines

> **Purpose**: This document provides essential architectural context, engineering standards, and operational guidelines for AI coding assistants working on the **Voxel QR** codebase.

---

## 1. Project Overview & Core Philosophy

**Voxel QR** is a full-screen, client-side 3D QR Code generator. It renders interactive 3D procedural voxel objects sitting on a tiled plot where ground tiles and top voxel surfaces resolve into a fully scannable QR code when viewed straight overhead.

### Key Architectural Constraints & Priorities
1. **UI & User Experience Above All**: UI and User Experience are first-class priorities in this project. While backend/rendering functionality is essential, **the UI and UX must NEVER be compromised under any situation**. The interface must remain sleek, clean, responsive, and visually cohesive.
2. **No Fancy / Creepy Icons**: Do NOT add fancy icons, gratuitous emojis, or decorative symbols in any files (code, UI text, or markdown documents). Maintain a clean, professional aesthetic.
3. **Zero Heavyweight 3D Engines**: Do NOT introduce Three.js, Babylon.js, or heavy external graphics frameworks. Rendering is driven by a custom indexed WebGL 2 mesher (`src/render/WebGLRenderer.ts`) with a 2D Canvas fallback (`src/render/CanvasRenderer.ts`).
4. **100% Client-Side Privacy**: Text, URLs, and uploaded photos must NEVER leave the user's browser. Depth estimation uses in-browser ONNX Runtime Web (`onnxruntime-web`), and QR verification uses `jsqr` and `zxing-wasm`.
5. **Guaranteed Scannability**: QR codes generated must adhere to strict error correction standards (High / Level H). The top-down orthographic camera mode flat-lights the model and aligns vertex colors to ensure phone camera readability.

---

## 2. Directory Structure & Layer Responsibilities

```
src/
├── core/qr/         # Pure QR code matrix generation & SVG export
├── voxel/           # Voxel grid, plot layout, color palette & top-voxel fit algorithm
├── objects/         # 36 procedural voxel models across 8 categories
│   ├── models/      # Modular category models (business, education, food, medical, nature, sports, tech, vehicles)
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

### Module Boundaries
- **`src/core/qr`**: Pure logic for generating QR code matrices. Must remain free of UI or rendering code.
- **`src/voxel/fit.ts`**: Core algorithm that maps QR module light/dark states to top-surface voxel materials (`computeFit`) without altering 3D geometry.
- **`src/objects/models/`**: Procedural voxel model definitions grouped logically by category.
- **`src/objects/helpers/`**: Reusable building blocks for model construction (lathes, boxes, vehicle wheels, foliage).
- **`src/render/shaders/`**: Modular WebGL 2 GLSL vertex and fragment shaders.
- **`src/ui/components/`**: Decoupled, modular UI components that encapsulate DOM creation and component-local event handling.

---

## 3. Engineering & Operational Rules for AI Assistants

### Skill Usage Protocol
- **Use Applicable Skills**: Always use specialized skills relevant to the task or prompt given.
- **Skill Installation**: If a required skill is not available in your system, prompt the user to install it. Ensure any recommended skill has high downloads, stars, and solid community reviews.
- **Commit Messages**: When committing, check if the `caveman-commit` skill is available. Use `caveman-commit` to generate commit messages if present; otherwise, fall back to standard semantic commit conventions (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`).

### Commit Control
- **Do NOT Commit Automatically**: Never commit changes to git unless the user explicitly instructs you to do so.

### Verification & Browser Testing Rule
- **Mandatory Browser Testing**: After any code change, bug fix, or UI refactor, **always test and verify the result in the browser** using Playwright or browser agent tools before declaring completion.
- **Automated Test Suite**: Run `npm test` (`vitest`) to verify that core QR generation, layout math, and model rendering tests pass 100%.

---

## 4. Coding & Shader Standards

### TypeScript & Type Safety
- Enforce strict typing. Do not use `any` unless interacting with third-party untyped libraries.
- Standardize on interfaces for data structures (`VoxelModel`, `QRData`, `ViewState`, `Mesh`).
- Keep data structures immutable where possible, especially around layout calculations.

### Performance & Memory Guidelines
- **Vertex Buffer Stride**: The WebGL mesher uses a 24-byte vertex stride (`VERTEX_STRIDE = 24`). Do not alter vertex attributes without updating `src/render/mesher.ts` and `src/render/shaders/meshShader.ts`.
- **Canvas & Buffer Reuse**: Avoid allocating temporary HTMLCanvasElement or large typed arrays inside the animation render loop (`requestAnimationFrame`). Reuse buffers.
- **Lazy Loading**: Heavy dependencies (`depth.ts`, `zxing-wasm`, `pipeline.ts`) must remain lazily imported (`import(...)`) so initial load time stays ultra-fast (<100ms).

### Shader Rules
- Shader versions: WebGL 2 GLSL (`#version 300 es`).
- Uniform names follow `u_` prefix (e.g., `u_viewProj`, `u_resolve`, `u_flat`, `u_build`).
- Attributes follow `a_` prefix (e.g., `a_pos`, `a_col`, `a_aux`, `a_alt`).
