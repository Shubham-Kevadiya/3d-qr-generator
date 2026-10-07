import { ICONS } from '../icons';
import type { LookName } from '../../photo/scanColors';

export type LookChoice = 'auto' | LookName;

export const LOOK_LABELS: [LookChoice, string, string][] = [
  ['auto', 'Auto', 'Pick the most photo-like look that still scans'],
  ['soft', 'Photo-like', 'Keeps your photo as it is'],
  ['firm', 'Balanced', 'A little firmer for tougher scanners'],
  ['max', 'Easy scan', 'Strongest, easiest for any phone'],
];

export interface PhotoRowOptions {
  initialLook?: LookChoice;
  onChangePhoto: () => void;
  onLookChange: (look: LookChoice) => void;
}

export class PhotoRowComponent {
  readonly element: HTMLElement;
  readonly photoName: HTMLElement;
  private readonly lookInputs = new Map<LookChoice, HTMLInputElement>();
  private currentLook: LookChoice;

  constructor(options: PhotoRowOptions) {
    this.currentLook = options.initialLook ?? 'auto';

    const row = document.createElement('div');
    row.className = 'photo-options';
    row.hidden = true;

    const change = document.createElement('button');
    change.type = 'button';
    change.className = 'btn ghost small';
    change.innerHTML = `${ICONS.upload}<span>Change photo</span>`;
    change.addEventListener('click', () => options.onChangePhoto());

    this.photoName = document.createElement('span');
    this.photoName.className = 'photo-name';

    const looks = document.createElement('div');
    looks.className = 'segmented';
    looks.setAttribute('role', 'radiogroup');
    looks.setAttribute('aria-label', 'Scan strength');

    for (const [value, text, description] of LOOK_LABELS) {
      const label = document.createElement('label');
      label.className = 'segment';
      label.title = description;

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.className = 'sr-only';
      radio.name = 'look';
      radio.value = value;
      radio.checked = value === this.currentLook;
      radio.addEventListener('change', () => {
        this.currentLook = value;
        options.onLookChange(value);
      });

      this.lookInputs.set(value, radio);
      const span = document.createElement('span');
      span.className = 'look-text';
      span.textContent = text;
      label.append(radio, span);
      looks.append(label);
    }

    row.append(change, this.photoName, looks);
    this.element = row;
  }

  setPhotoName(name: string): void {
    this.photoName.textContent = name;
    this.photoName.title = name;
  }

  setLook(look: LookChoice): void {
    this.currentLook = look;
    const radio = this.lookInputs.get(look);
    if (radio) radio.checked = true;
  }

  getLook(): LookChoice {
    return this.currentLook;
  }

  show(): void {
    this.element.hidden = false;
  }

  hide(): void {
    this.element.hidden = true;
  }
}
