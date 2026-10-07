import { ICONS } from '../icons';

export class ScanOverlayComponent {
  readonly element: HTMLElement;
  readonly image: HTMLImageElement;
  private scanUrl: string | null = null;

  constructor() {
    const overlay = document.createElement('div');
    overlay.className = 'scan-overlay';
    overlay.hidden = true;

    const bar = document.createElement('div');
    bar.className = 'scan-bar';

    const hint = document.createElement('p');
    hint.className = 'scan-hint';
    hint.textContent = 'Hold any phone up to the screen';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'icon-btn';
    close.innerHTML = ICONS.close;
    close.setAttribute('aria-label', 'Close scan view');
    close.addEventListener('click', () => this.close());
    bar.append(hint, close);

    const frame = document.createElement('div');
    frame.className = 'scan-frame';

    this.image = document.createElement('img');
    this.image.alt = 'Full-screen QR code';
    frame.append(this.image);

    overlay.append(bar, frame);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay || event.target === frame) this.close();
    });

    this.element = overlay;
  }

  show(imageBlob: Blob): void {
    if (this.scanUrl) URL.revokeObjectURL(this.scanUrl);
    this.scanUrl = URL.createObjectURL(imageBlob);
    this.image.src = this.scanUrl;
    this.element.hidden = false;
  }

  close(): void {
    this.element.hidden = true;
    if (this.scanUrl) {
      URL.revokeObjectURL(this.scanUrl);
      this.scanUrl = null;
    }
  }

  isOpen(): boolean {
    return !this.element.hidden;
  }
}
