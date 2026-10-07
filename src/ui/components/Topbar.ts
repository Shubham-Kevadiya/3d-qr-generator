import { ICONS, LOGO } from '../icons';

export interface TopbarOptions {
  onShare: () => void;
  onOpenInfo: () => void;
}

export class TopbarComponent {
  readonly element: HTMLElement;
  readonly verify: HTMLElement;
  readonly verifyText: HTMLElement;

  constructor(options: TopbarOptions) {
    const bar = document.createElement('header');
    bar.className = 'topbar';

    const brand = document.createElement('a');
    brand.className = 'brand';
    brand.href = window.location.pathname;
    brand.setAttribute('aria-label', 'Voxel QR');

    const mark = document.createElement('span');
    mark.className = 'brand-mark';
    mark.innerHTML = LOGO;

    const name = document.createElement('span');
    name.className = 'brand-name';
    name.textContent = 'Voxel QR';
    brand.append(mark, name);

    this.verify = document.createElement('div');
    this.verify.className = 'verify';
    this.verify.setAttribute('role', 'status');
    this.verify.dataset.state = 'idle';

    const dot = document.createElement('span');
    dot.className = 'dot';
    this.verifyText = document.createElement('span');
    this.verify.append(dot, this.verifyText);

    const actions = document.createElement('div');
    actions.className = 'top-actions';

    const share = document.createElement('button');
    share.type = 'button';
    share.className = 'icon-btn';
    share.innerHTML = ICONS.share;
    share.setAttribute('aria-label', 'Copy share link');
    share.title = 'Copy share link';
    share.addEventListener('click', () => options.onShare());

    const info = document.createElement('button');
    info.type = 'button';
    info.className = 'icon-btn';
    info.innerHTML = ICONS.info;
    info.setAttribute('aria-label', 'How it works');
    info.title = 'How it works';
    info.addEventListener('click', () => options.onOpenInfo());

    actions.append(share, info);
    bar.append(brand, this.verify, actions);
    this.element = bar;
  }

  setVerifyState(state: 'idle' | 'checking' | 'ok' | 'fail', text: string): void {
    this.verify.dataset.state = state;
    this.verifyText.textContent = text;
  }
}
