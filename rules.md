# Voxel QR — AI Rules & Project Guidelines

> **Purpose**: This document provides essential architectural context, engineering standards, and operational guidelines for AI coding assistants working on the **Voxel QR** codebase.

---

## 1. Project Overview & Core Philosophy

**Voxel QR** is a full-screen, client-side 3D QR Code generator. It renders interactive 3D procedural voxel objects sitting on a tiled plot where ground tiles and top voxel surfaces resolve into a fully scannable QR code when viewed from straight overhead.

### Key Architectural Constraints
1. **Zero Heavyweight 3D Engines**: Do NOT introduce Three.js, Babylon.js, or heavy graphics frameworks. Rendering is driven by a custom indexed WebGL 2 mesher (`src/render/WebGLRenderer.ts`) with a 2D Canvas fallback (`src/render/CanvasRenderer.ts`).
2. **100% Client-Side Privacy**: Text, URLs, and uploaded photos must NEVER leave the user's browser. Depth estimation uses in-browser ONNX Runtime Web (`onnxruntime-web`), and QR verification uses `jsqr` and `zxing-wasm`.
3. **Guaranteed Scannability**: QR codes generated must adhere to strict error correction standards (High / Level H). The top-down orthographic camera mode flat-lights the model and aligns vertex colors to ensure phone camera readability.

---

## 2. Directory Structure & Layer Responsibilities

```
src/
├── core/qr/         # Pure QR code matrix generation & SVG export
├── voxel/           # Voxel grid, plot layout, color palette & top-voxel fit algorithm
├── objects/         # 36 procedural voxel models across 8 categories with color variants
├── render/          # Custom WebGL 2 / Canvas 2D renderer, mesher, lighting & camera timeline
├── photo/           # Photo mode: QArt encoding, depth estimation, relief & ZXing scan tuning
├── ui/              # Main application UI, state manager, verification & embedding
└── main.ts          # Application entry point
```

### Module Boundaries
- **`src/core/qr`**: Pure logic for generating QR code matrices. Must remain free of UI or rendering code.
- **`src/voxel/fit.ts`**: Core algorithm that maps QR module light/dark states to top-surface voxel materials (`computeFit`) without altering 3D geometry.
- **`src/objects/`**: All 3D voxel models are defined procedurally via voxel grid manipulation (`build`) and palette generation (`createPalette`).
- **`src/render/timeline.ts`**: Pure mathematical curves for camera movement, elevation, orthographic interpolation, and color resolution. Must remain pure and unit-testable.

---

## 3. Engineering & Coding Standards

### TypeScript & Type Safety
- Enforce strict typing. Do not use `any` unless interacting with third-party untyped libraries.
- Standardize on interfaces for data structures (e.g., `VoxelModel`, `QRData`, `ViewState`, `Mesh`).
- Keep data structures immutable where possible, especially around layout calculations.

### Performance & Memory Guidelines
- **Vertex Buffer Stride**: The WebGL mesher uses a 24-byte vertex stride (`VERTEX_STRIDE = 24`). Do not alter vertex attributes without updating both `src/render/mesher.ts` and the GLSL shader source in `src/render/WebGLRenderer.ts`.
- **Canvas Allocation**: Avoid allocating temporary HTMLCanvasElement or large typed arrays inside the animation render loop (`requestAnimationFrame`). Reuse buffers or offscreen canvases.
- **Lazy Loading**: Heavy dependencies (`depth.ts`, `zxing-wasm`, `pipeline.ts`) must remain lazily imported (`import(...)`) so initial load time stays under 100ms.

### Shader & Rendering Rules
- Shader versions: WebGL 2 GLSL (`#version 300 es`).
- Uniform names follow `u_` prefix (e.g., `u_viewProj`, `u_resolve`, `u_flat`, `u_build`).
- Attributes follow `a_` prefix (e.g., `a_pos`, `a_col`, `a_aux`, `a_alt`).

---

## 4. Verification & Testing Requirements

- **Unit Tests**: Run `npm test` (`vitest`) before committing any changes. All tests must pass cleanly.
- **QR Scannability Checks**: Every object model build must be verifiable against `jsqr`. Do not commit changes to `fit.ts`, `ground.ts`, or `mesher.ts` that break finder pattern or data matrix readability.
- **Visual Verification**: Ensure both WebGL 2 mode and Canvas 2D fallback mode function properly.

---

## 5. Guidelines for AI Assistants

1. **Inspect Before Modifying**: Always view complete file context and imports before editing existing logic.
2. **Preserve API Contracts**: Do not break existing URL query parameters (`?q=...&o=...&v=...&t=...`) or embed options (`?embed=1...`).
3. **No Phantom Dependencies**: Do not introduce npm dependencies for tasks easily solved with standard TypeScript / Web APIs.
4. **Clean Commits**: Keep commit messages scoped, using standard semantic prefixes (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`).

