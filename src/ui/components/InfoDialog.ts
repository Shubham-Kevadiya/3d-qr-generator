import { MAX_QR_CHARS } from '../../core/qr/QRGenerator';
import { ICONS } from '../icons';

export class InfoDialogComponent {
  readonly element: HTMLDialogElement;

  constructor() {
    const dialog = document.createElement('dialog');
    dialog.className = 'info';
    dialog.setAttribute('aria-labelledby', 'info-title');

    const head = document.createElement('div');
    head.className = 'info-head';

    const title = document.createElement('h2');
    title.id = 'info-title';
    title.textContent = 'How Voxel QR works';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'icon-btn';
    close.innerHTML = ICONS.close;
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', () => dialog.close());
    head.append(title, close);

    const steps = document.createElement('ol');
    steps.className = 'info-steps';
    const copy: [string, string][] = [
      ['Paste a link', `Anything up to ${MAX_QR_CHARS} characters. The code uses the highest error correction.`],
      ['Meet your model', "Pick a category and design, color and time of day. The code is laid into the ground tiles and grows through the model's surfaces."],
      ['Tap to reveal', "The camera lifts overhead, the lighting flattens and the model's own colors resolve into the code. Scan it straight off the screen."],
      ['Or use your own photo', 'Choose Your photo, then upload one, paste a public image link, or drop an image anywhere. It becomes an embossed 3D relief whose colors resolve into a scannable code, tuned automatically so it still reads.'],
      ['Check and share', 'We decode the rendered image in your browser and show a verified badge. Save a PNG or a print-ready SVG, or copy a share link.'],
    ];

    for (const [heading, body] of copy) {
      const item = document.createElement('li');
      const strong = document.createElement('strong');
      strong.textContent = heading;
      const span = document.createElement('span');
      span.textContent = body;
      item.append(strong, span);
      steps.append(item);
    }

    const privacy = document.createElement('p');
    privacy.className = 'info-note';
    privacy.textContent = 'Everything runs in your browser. Your text and photos are never uploaded, and there is no account or tracking. (An image link is fetched by your browser straight from its own site; if that site blocks it, the link is retried through the images.weserv.nl proxy.) For the easiest scan, open Save → Full-screen scan. The first photo downloads a small depth model (about 27 MB) once and keeps it in your browser.';

    const keys = document.createElement('p');
    keys.className = 'info-note';
    keys.textContent = 'Shortcuts: Space or R reveals, T changes the time of day, arrow keys rotate.';

    dialog.append(head, steps, privacy, keys);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });

    this.element = dialog;
  }

  show(): void {
    this.element.showModal();
  }

  close(): void {
    this.element.close();
  }
}
