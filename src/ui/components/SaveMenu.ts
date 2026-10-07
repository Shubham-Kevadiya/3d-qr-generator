import { ICONS } from '../icons';

export interface SaveMenuItem {
  title: string;
  detail: string;
  action: () => void;
}

export class SaveMenuComponent {
  readonly element: HTMLElement;
  readonly button: HTMLButtonElement;
  readonly menu: HTMLElement;

  constructor(items: SaveMenuItem[]) {
    const wrap = document.createElement('div');
    wrap.className = 'save-wrap';

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'btn ghost';
    this.button.innerHTML = `${ICONS.save}<span>Save</span>`;
    this.button.setAttribute('aria-haspopup', 'menu');
    this.button.setAttribute('aria-expanded', 'false');
    this.button.addEventListener('click', () => (this.menu.hidden ? this.open() : this.close()));

    this.menu = document.createElement('div');
    this.menu.className = 'menu';
    this.menu.hidden = true;
    this.menu.setAttribute('role', 'menu');

    for (const { title, detail, action } of items) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'menu-item';
      item.setAttribute('role', 'menuitem');

      const titleEl = document.createElement('span');
      titleEl.className = 'menu-title';
      titleEl.textContent = title;

      const detailEl = document.createElement('span');
      detailEl.className = 'menu-detail';
      detailEl.textContent = detail;

      item.append(titleEl, detailEl);
      item.addEventListener('click', () => {
        this.close();
        action();
      });
      this.menu.append(item);
    }

    wrap.append(this.button, this.menu);
    this.element = wrap;
  }

  open(): void {
    this.menu.hidden = false;
    this.button.setAttribute('aria-expanded', 'true');
  }

  close(): void {
    this.menu.hidden = true;
    this.button.setAttribute('aria-expanded', 'false');
  }

  isOpen(): boolean {
    return !this.menu.hidden;
  }
}
