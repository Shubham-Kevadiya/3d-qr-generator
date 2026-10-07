import { generateQRMatrix, QRInputError, type QRData } from '../core/qr/QRGenerator';
import { qrToSvg } from '../core/qr/qrSvg';
import { getObject, OBJECTS, getObjectsByCategory, type VoxelObject } from '../objects';
import { LIGHTING, TIMES_OF_DAY, type TimeOfDay } from '../render/lighting';
import { buildMesh } from '../render/mesher';
import { Viewer, type ViewerState } from '../render/Viewer';
import { buildModel } from '../voxel/buildModel';
import { IDLE_ELEVATION } from '../render/timeline';
import { embedSnippet, embedUrl, parseCommand, parseEmbed, type EmbedEvent, type EmbedOptions, type EmbedPhoto } from './embed';
import { embedDataToFile, photoToEmbedData, PhotoReadError, PhotoSession } from './photoSession';
import { readState, writeQuery, type AppState } from './state';
import { decodeImage } from './verify';

import { TopbarComponent } from './components/Topbar';
import { InfoDialogComponent } from './components/InfoDialog';
import { SourceDialogComponent } from './components/SourceDialog';
import { ScanOverlayComponent } from './components/ScanOverlay';
import { DockComponent } from './components/Dock';
import type { LookChoice } from './components/PhotoRow';
import { LOOK_LABELS } from './components/PhotoRow';

const DEFAULT_STATE: AppState = { text: 'https://example.com', objectId: OBJECTS[0].id, variantId: OBJECTS[0].variants[0].id, time: 'night' };
type VerifyState = 'idle' | 'checking' | 'ok' | 'fail';
const PHOTO_ID = 'photo';
const SIDE_PANEL_QUERY = '(orientation: landscape) and (max-height: 520px)';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export class App {
  private state: AppState;
  private qr: QRData | null = null;
  private readonly viewer: Viewer;
  private generation = 0;
  private debounce = 0;
  private toastTimer = 0;

  private readonly stage = el('div', 'stage');
  private readonly hint = el('p', 'hint');
  private readonly loading = el('div', 'loading');
  private readonly toast = el('div', 'toast');
  private readonly embed: EmbedOptions | null = parseEmbed(window.location.search, window.location.hash);
  private readonly embedBar = el('div', 'embed-controls');
  private readonly embedHint = el('p', 'embed-hint', 'Drag to rotate · tap to reveal the QR');
  private readonly embedButton = el('button', 'embed-btn');
  private embedStarted = false;
  private readonly photo = new PhotoSession();
  private readonly fileInput = el('input');
  private readonly dropOverlay = el('div', 'drop-overlay', 'Drop a photo to turn it into a 3D relief');
  private readonly loadingText = el('span', '', 'Building your model…');

  private readonly topbar: TopbarComponent;
  private readonly infoDialog: InfoDialogComponent;
  private readonly sourceDialog: SourceDialogComponent;
  private readonly scanOverlay: ScanOverlayComponent;
  private readonly dock: DockComponent;

  private look: LookChoice = 'auto';
  private regular = { objectId: OBJECTS[0].id, variantId: OBJECTS[0].variants[0].id };

  constructor(private readonly root: HTMLElement) {
    this.state = readState(window.location.search, DEFAULT_STATE);
    if (this.embed) {
      if (this.embed.text) this.state.text = this.embed.text;
      if (!this.embed.timeGiven) this.state.time = 'day';
      if (this.embed.photo) this.state.objectId = PHOTO_ID;
    } else if (!window.location.search && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
      this.state.time = 'day';
    }

    root.classList.add('app');
    if (this.embed) {
      root.classList.add('embed');
      root.dataset.bg = this.embed.background;
      if (this.embed.background === 'transparent') document.documentElement.classList.add('embed-transparent');
    }

    this.regular = { objectId: this.state.objectId, variantId: this.state.variantId };

    this.topbar = new TopbarComponent({
      onShare: () => void this.share(),
      onOpenInfo: () => this.infoDialog.show(),
    });

    this.infoDialog = new InfoDialogComponent();

    this.fileInput.type = 'file';
    this.fileInput.accept = 'image/*';
    this.fileInput.hidden = true;
    this.fileInput.setAttribute('aria-label', 'Choose a photo');
    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files?.[0];
      this.fileInput.value = '';
      if (file) void this.loadPhoto(file);
    });
    this.fileInput.addEventListener('cancel', () => this.restoreObjectSelect());

    this.sourceDialog = new SourceDialogComponent({
      onFileSelect: () => this.fileInput.click(),
      onPhotoLoaded: (file) => this.loadPhoto(file),
      onDismiss: () => this.restoreObjectSelect(),
    });

    this.scanOverlay = new ScanOverlayComponent();

    this.dock = new DockComponent({
      initialText: this.state.text,
      initialTime: this.state.time,
      initialObjectId: this.state.objectId,
      initialVariantId: this.state.variantId,
      saveItems: [
        { title: 'Full-screen scan', detail: 'Big and flat, easiest to scan', action: () => void this.openScanOverlay() },
        { title: 'Copy embed code', detail: 'Iframe for any website', action: () => void this.copyEmbed() },
        { title: 'Scan image', detail: 'PNG, flat QR', action: () => void this.save('scan') },
        { title: 'Model image', detail: 'PNG, 3D view', action: () => void this.save('object') },
        { title: 'Print-ready SVG', detail: 'Black and white vector', action: () => this.saveSvg() },
      ],
      onTextInput: (text) => {
        this.state.text = text;
        window.clearTimeout(this.debounce);
        this.debounce = window.setTimeout(() => void this.generate(), 450);
      },
      onEnterKey: () => {
        window.clearTimeout(this.debounce);
        void this.generate();
      },
      onRevealToggle: () => this.viewer.toggle(),
      onObjectChange: (objectId, variantId) => {
        this.leavePhotoMode();
        this.state.objectId = objectId;
        this.state.variantId = variantId;
        this.regular = { objectId, variantId };
        void this.generate();
      },
      onVariantChange: (variantId) => {
        this.state.variantId = variantId;
        this.regular.variantId = variantId;
        void this.generate();
      },
      onChoosePhoto: () => this.choosePhoto(),
      onTimeChange: (time) => this.chooseTime(time),
      onLookChange: (look) => {
        this.look = look;
        if (this.state.objectId === PHOTO_ID) void this.generate();
      },
    });

    this.loading.setAttribute('role', 'status');
    this.loading.append(el('span', 'spinner'), this.loadingText);
    this.loading.hidden = true;

    root.append(
      this.buildSky(),
      this.stage,
      this.topbar.element,
      this.hint,
      this.dock.element,
      this.loading,
      this.toast,
      this.infoDialog.element,
      this.sourceDialog.element,
      this.dropOverlay,
      this.scanOverlay.element,
      this.buildEmbedControls()
    );

    this.viewer = new Viewer(this.stage, (viewerState) => this.onViewer(viewerState));
    this.viewer.setTimeOfDay(this.state.time);
    this.applyTime();
    if (this.embed) this.startEmbed(this.embed);

    new ResizeObserver(() => this.syncInsets()).observe(this.dock.element);
    window.matchMedia?.(SIDE_PANEL_QUERY).addEventListener?.('change', () => this.syncInsets());
    this.trackKeyboard();
    document.addEventListener('keydown', (event) => this.onKey(event));
    document.addEventListener('click', (event) => {
      const target = event.target as Node;
      if (this.dock.saveMenu.isOpen() && !this.dock.saveMenu.menu.contains(target) && !this.dock.saveMenu.button.contains(target)) {
        this.dock.saveMenu.close();
      }
    });

    this.attachDrop();
    this.syncInsets();
    this.onViewer({ mode: 'object', busy: false, renderer: this.viewer.rendererKind });
    if (this.embed?.photo) void this.loadEmbedPhoto(this.embed.photo);
    else void this.generate();
  }

  private async loadEmbedPhoto(photo: EmbedPhoto): Promise<void> {
    try {
      await this.photo.load(embedDataToFile(photo));
      this.look = photo.look;
      this.dock.photoRow.setLook(photo.look);
      this.enterPhotoMode();
    } catch (error) {
      console.error(error);
      this.state.objectId = OBJECTS[0].id;
      this.state.variantId = OBJECTS[0].variants[0].id;
      this.regular = { objectId: this.state.objectId, variantId: this.state.variantId };
      this.dock.leavePhotoMode(this.regular.objectId, this.regular.variantId);
      this.setVerify('fail');
      this.setStatus('Could not load the embedded photo.', true);
    }
    await this.generate();
  }

  private buildSky(): HTMLElement {
    const sky = el('div', 'sky');
    sky.setAttribute('aria-hidden', 'true');
    for (const time of TIMES_OF_DAY) {
      const layer = el('div', `sky-layer ${time}`);
      layer.dataset.time = time;
      sky.append(layer);
    }
    sky.append(el('div', 'stars'), el('div', 'vignette'));
    return sky;
  }

  private attachDrop(): void {
    let depth = 0;
    const hasFiles = (event: DragEvent): boolean => Array.from(event.dataTransfer?.types ?? []).includes('Files');
    window.addEventListener('dragenter', (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth++;
      this.root.classList.add('dragging-file');
    });
    window.addEventListener('dragover', (event) => {
      if (hasFiles(event)) event.preventDefault();
    });
    window.addEventListener('dragleave', (event) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) this.root.classList.remove('dragging-file');
    });
    window.addEventListener('drop', (event) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      this.root.classList.remove('dragging-file');
      const file = event.dataTransfer?.files?.[0];
      if (file) void this.loadPhoto(file);
    });
  }

  private choosePhoto(): void {
    if (this.viewer.rendererKind === 'canvas') {
      this.showToast('Photos need WebGL 2, which this device does not support');
      this.restoreObjectSelect();
      return;
    }
    if (this.photo.ready) {
      this.enterPhotoMode();
      void this.generate();
      return;
    }
    this.sourceDialog.show();
  }

  private restoreObjectSelect(): void {
    this.dock.syncPickers();
  }

  private async loadPhoto(file: File): Promise<void> {
    if (this.viewer.rendererKind === 'canvas') {
      this.showToast('Photos need WebGL 2, which this device does not support');
      return;
    }
    this.showLoading('Reading your photo…');
    await nextPaint();
    try {
      await this.photo.load(file);
    } catch (error) {
      this.loading.hidden = true;
      this.showToast(error instanceof PhotoReadError ? error.message : 'Could not read that image');
      this.restoreObjectSelect();
      return;
    }
    this.dock.photoRow.setPhotoName(file.name);
    this.enterPhotoMode();
    await this.generate();
  }

  private enterPhotoMode(): void {
    this.state.objectId = PHOTO_ID;
    this.dock.enterPhotoMode();
    this.viewer.setRestingView(0.95, 0.12);
  }

  private leavePhotoMode(): void {
    if (this.state.objectId !== PHOTO_ID) return;
    this.dock.leavePhotoMode(this.regular.objectId, this.regular.variantId);
    this.viewer.setRestingView(IDLE_ELEVATION, Math.PI / 4);
  }

  private showLoading(message: string): void {
    this.loadingText.textContent = message;
    this.loading.hidden = false;
  }

  private photoQrData(code: { qr: { matrix: Uint8Array }; modules: number; version: number; text: string }): QRData {
    const matrix: boolean[][] = [];
    for (let r = 0; r < code.modules; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < code.modules; c++) row.push(code.qr.matrix[r * code.modules + c] === 1);
      matrix.push(row);
    }
    return { matrix, size: code.modules, content: code.text, version: code.version };
  }

  private async generatePhoto(ticket: number): Promise<void> {
    const text = this.state.text.trim();
    if (!text) {
      this.setStatus('Enter some text or a URL first.', true);
      this.setVerify('idle');
      return;
    }
    if (!this.photo.ready) {
      this.setStatus('Choose a photo to continue.');
      return;
    }
    this.setStatus('');
    this.setVerify('checking');
    this.showLoading('Reading your photo…');
    await nextPaint();

    try {
      const pipeline = await import('../photo/pipeline');
      const depth = await this.photo.depthFor(pipeline.estimateDepth, (message) => this.showLoading(message));
      if (ticket !== this.generation) return;
      this.showLoading('Encoding your QR code…');
      await nextPaint();
      const code = pipeline.prepareCode(text, this.photo.square!, depth.depth);
      if (ticket !== this.generation) return;

      let start = pipeline.LOOK_ORDER.indexOf(this.look === 'auto' ? 'soft' : this.look);
      if (this.look === 'auto') {
        this.showLoading('Tuning the scan…');
        await nextPaint();
        const choice = await pipeline.chooseLook(code.photo, code.modules, code.moduleVoxels, code.qr.matrix, text, pipeline.decodeWithZXing);
        start = pipeline.LOOK_ORDER.indexOf(choice.look);
        if (ticket !== this.generation) return;
      }

      let verified = false;
      let used = pipeline.LOOK_ORDER[start];
      for (let i = start; i < pipeline.LOOK_ORDER.length; i++) {
        used = pipeline.LOOK_ORDER[i];
        this.showLoading('Sculpting the 3D relief…');
        await nextPaint();
        const model = pipeline.buildPhotoModel(code, used);
        const mesh = buildMesh(model, { allPlot: true, soften: 0.82, shadows: false });
        if (ticket !== this.generation) return;
        this.viewer.setMesh(mesh);
        this.qr = this.photoQrData(code);
        await nextPaint();
        if (ticket !== this.generation) return;
        const image = this.viewer.renderScanImage(900);
        const decoded = image ? await pipeline.decodeWithZXing({ data: image.data, width: image.width, height: image.height }) : null;
        verified = decoded === text;
        if (verified || this.look !== 'auto') break;
      }
      if (ticket !== this.generation) return;
      this.setVerify(verified ? 'ok' : 'fail');
      const source = depth.source === 'model' ? 'AI depth' : 'built-in relief';
      const strength = LOOK_LABELS.find(([value]) => value === used)?.[1] ?? used;
      this.setStatus(`Your photo · ${source} · ${strength}${depth.source === 'heuristic' ? ' (depth model unavailable, using a simpler relief)' : ''}`);
      this.syncUrl();
    } catch (error) {
      console.error(error);
      const { PhotoError } = await import('../photo/pipeline');
      this.setStatus(error instanceof PhotoError ? error.message : 'Could not build the photo model. Try another photo.', true);
      this.setVerify('fail');
    } finally {
      if (ticket === this.generation) this.loading.hidden = true;
    }
  }

  private chooseTime(time: TimeOfDay): void {
    this.state.time = time;
    this.viewer.setTimeOfDay(time);
    this.dock.setTime(time);
    this.applyTime();
    this.syncUrl();
  }

  private applyTime(): void {
    const time = this.state.time;
    this.root.dataset.time = time;
    this.root.dataset.tone = LIGHTING[time].tone;
    for (const layer of this.root.querySelectorAll<HTMLElement>('.sky-layer')) layer.classList.toggle('active', layer.dataset.time === time);
    const themeColor = document.querySelector('meta[name="theme-color"]');
    themeColor?.setAttribute('content', LIGHTING[time].tone === 'dark' ? '#0b0f18' : '#e9eff7');
    this.dock.setTime(time);
  }

  private onViewer(state: ViewerState): void {
    const scanning = state.mode === 'scan';
    this.dock.revealButton.innerHTML = `<span>${scanning ? 'Show model' : 'Reveal QR'}</span>`;
    this.dock.revealButton.setAttribute('aria-pressed', String(scanning));
    this.hint.textContent = state.renderer === 'canvas' && !scanning
      ? 'Compatibility mode · tap the model to reveal the QR'
      : scanning ? (this.state.objectId === PHOTO_ID ? 'Easiest to scan: Save → Full-screen scan · tap to bring the model back' : 'Scan with your phone camera · tap to bring the model back') : 'Drag to rotate · tap the model to reveal the QR';
    this.root.dataset.mode = state.mode;
    if (this.embed) {
      this.embedButton.innerHTML = this.dock.revealButton.innerHTML;
      if (scanning) this.embedHint.classList.add('hidden');
      this.postEmbed('state', state.mode, state.busy);
    }
  }

  private trackKeyboard(): void {
    const viewport = window.visualViewport;
    if (viewport) {
      const fit = (): void => {
        const covered = window.innerHeight - viewport.height - viewport.offsetTop;
        const shifted = viewport.offsetTop > 1 || covered > 80;
        this.root.style.setProperty('--app-top', shifted ? `${viewport.offsetTop}px` : '0px');
        this.root.style.setProperty('--app-height', shifted ? `${viewport.height}px` : '100%');
      };
      viewport.addEventListener('resize', fit);
      viewport.addEventListener('scroll', fit);
    }
    this.dock.input.addEventListener('focus', () => this.root.classList.add('typing'));
    this.dock.input.addEventListener('blur', () => this.root.classList.remove('typing'));
  }

  private syncInsets(): void {
    const dockHeight = this.dock.element.offsetHeight;
    const compact = window.innerWidth < 640;
    if (this.embed) {
      const bottom = (this.embed.controls ? 58 : 0) + (this.embed.hint ? 38 : 0);
      this.viewer?.setInsets({ top: 0, bottom });
      return;
    }
    if (window.matchMedia?.(SIDE_PANEL_QUERY).matches) {
      this.viewer?.setInsets({ top: 56, bottom: 56 });
      this.root.style.setProperty('--dock-height', '0px');
      return;
    }
    const hintRoom = window.innerWidth < 400 ? 84 : compact ? 64 : 76;
    this.viewer?.setInsets({ top: compact ? 64 : 72, bottom: dockHeight + hintRoom });
    this.root.style.setProperty('--dock-height', `${dockHeight}px`);
  }

  private setVerify(state: VerifyState): void {
    const text = {
      idle: '',
      checking: 'Checking scan…',
      ok: 'Verified scannable',
      fail: 'Could not verify this scan',
    }[state];
    this.topbar.setVerifyState(state, text);
  }

  private setStatus(message: string, isError = false): void {
    this.dock.setStatus(message, isError);
  }

  private syncUrl(): void {
    if (this.embed) return;
    try {
      const shared = this.state.objectId === PHOTO_ID ? { ...this.state, ...this.regular } : this.state;
      window.history.replaceState(null, '', `?${writeQuery(shared)}`);
    } catch {
      /* history unavailable in some embeds */
    }
  }

  private async generate(): Promise<void> {
    window.clearTimeout(this.debounce);
    const ticket = ++this.generation;
    if (this.state.objectId === PHOTO_ID) {
      await this.generatePhoto(ticket);
      return;
    }
    this.loadingText.textContent = 'Building your model…';
    let qr: QRData;
    try {
      qr = generateQRMatrix(this.state.text);
    } catch (error) {
      this.setStatus(error instanceof QRInputError ? error.message : 'Could not create that QR code. Try different text.', true);
      this.setVerify('idle');
      return;
    }
    this.setStatus('');
    this.setVerify('checking');
    this.loading.hidden = false;
    await nextPaint();
    if (ticket !== this.generation) return;

    try {
      const model = buildModel(qr, {
        objectId: this.state.objectId,
        variantId: this.state.variantId,
        compat: this.viewer.rendererKind === 'canvas',
      });
      const mesh = buildMesh(model);
      if (ticket !== this.generation) return;
      this.qr = qr;
      this.viewer.setMesh(mesh);
      if (this.embed) {
        if (this.embed.view === 'scan' && !this.embedStarted) this.viewer.setMode('scan');
        this.embedStarted = true;
        return;
      }
      this.syncUrl();
      await nextPaint();
      if (ticket !== this.generation) return;

      const image = this.viewer.renderScanImage(640);
      const decoded = image ? decodeImage(image) : null;
      this.setVerify(decoded === qr.content ? 'ok' : 'fail');
      if (decoded !== qr.content) console.warn('Scan verification mismatch', { expected: qr.content, decoded });
    } catch (error) {
      console.error(error);
      this.setStatus('Could not build the model on this device. Try shorter text.', true);
      this.setVerify('fail');
    } finally {
      if (ticket === this.generation) this.loading.hidden = true;
    }
  }

  private async save(kind: 'scan' | 'object'): Promise<void> {
    try {
      const blob = await this.viewer.exportImage(kind);
      download(blob, kind === 'scan' ? 'voxel-qr-scan.png' : `voxel-qr-${this.state.objectId}.png`);
      this.showToast('Image saved');
    } catch (error) {
      console.error(error);
      this.showToast('Could not create the image');
    }
  }

  private async openScanOverlay(): Promise<void> {
    try {
      const blob = await this.viewer.exportImage('scan');
      this.scanOverlay.show(blob);
    } catch (error) {
      console.error(error);
      this.showToast('Could not open the scan view');
    }
  }

  private buildEmbedControls(): HTMLElement {
    this.embedBar.hidden = !this.embed;
    if (!this.embed) return this.embedBar;
    this.embedButton.type = 'button';
    this.embedButton.addEventListener('click', () => this.viewer.toggle());
    this.embedHint.hidden = !this.embed.hint;
    this.embedButton.hidden = !this.embed.controls;
    this.embedBar.append(this.embedHint, this.embedButton);
    return this.embedBar;
  }

  private startEmbed(options: EmbedOptions): void {
    this.viewer.setAutoRotate(options.rotate);
    this.stage.addEventListener('pointerdown', () => this.embedHint.classList.add('hidden'), { once: true });
    window.addEventListener('message', (event) => {
      if (event.source !== window.parent) return;
      const command = parseCommand(event.data);
      if (command === 'reveal') this.viewer.setMode('scan');
      else if (command === 'hide') this.viewer.setMode('object');
      else if (command === 'toggle') this.viewer.toggle();
    });
    this.postEmbed('ready', 'object', false);
  }

  private postEmbed(type: EmbedEvent['type'], mode: EmbedEvent['mode'], busy: boolean): void {
    if (!this.embed || window.parent === window) return;
    const message: EmbedEvent = { source: 'voxel-qr', type, mode, busy };
    window.parent.postMessage(message, '*');
  }

  private async copyEmbed(): Promise<void> {
    let photo: EmbedPhoto | undefined;
    if (this.state.objectId === PHOTO_ID) {
      if (!this.photo.square) {
        this.showToast('Choose a photo before copying the embed code');
        return;
      }
      try {
        const { data, mime } = await photoToEmbedData(this.photo.square);
        photo = { data, mime, look: this.look };
      } catch (error) {
        console.error(error);
        this.showToast('Could not prepare the photo for embedding');
        return;
      }
    }
    const src = embedUrl(window.location.href, this.state, photo ? { photo } : {});
    const html = embedSnippet(src);
    const copied = await copyText(html);
    this.showToast(copied ? (photo ? 'Embed code copied (includes a small copy of your photo)' : 'Embed code copied') : 'Could not copy. Allow clipboard access and try again');
  }

  private saveSvg(): void {
    if (!this.qr) return;
    download(new Blob([qrToSvg(this.qr)], { type: 'image/svg+xml' }), 'voxel-qr.svg');
    this.showToast('SVG saved');
  }

  private async share(): Promise<void> {
    this.syncUrl();
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      this.showToast(this.state.objectId === PHOTO_ID ? 'Link copied (photos are not included)' : 'Share link copied');
    } catch {
      this.showToast('Copy the link from your address bar');
    }
  }

  private showToast(message: string): void {
    this.toast.textContent = message;
    this.toast.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('show'), 2200);
  }

  private onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.dock.saveMenu.close();
      this.scanOverlay.close();
      return;
    }
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text') return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'r' || event.key === 'R' || (event.key === ' ' && target.tagName !== 'BUTTON' && target.tagName !== 'LABEL')) {
      event.preventDefault();
      this.viewer.toggle();
    } else if (event.key === 't' || event.key === 'T') {
      const next = TIMES_OF_DAY[(TIMES_OF_DAY.indexOf(this.state.time) + 1) % TIMES_OF_DAY.length];
      this.chooseTime(next);
    }
  }
}
