import { ICONS } from '../icons';
import { MAX_QR_CHARS } from '../../core/qr/QRGenerator';
import { TIMES_OF_DAY, type TimeOfDay } from '../../render/lighting';
import { getCategories, getObjectsByCategory, getObject, type VoxelObject, type ObjectVariant } from '../../objects';
import { SaveMenuComponent, type SaveMenuItem } from './SaveMenu';
import { PhotoRowComponent, type PhotoRowOptions, type LookChoice } from './PhotoRow';

const TIME_LABELS: Record<TimeOfDay, string> = { dawn: 'Dawn', day: 'Day', dusk: 'Dusk', night: 'Night' };
const PHOTO_ID = 'photo';

export interface DockOptions {
  initialText: string;
  initialTime: TimeOfDay;
  initialObjectId: string;
  initialVariantId: string;
  saveItems: SaveMenuItem[];
  onTextInput: (text: string) => void;
  onEnterKey: () => void;
  onRevealToggle: () => void;
  onObjectChange: (objectId: string, variantId: string) => void;
  onVariantChange: (variantId: string) => void;
  onChoosePhoto: () => void;
  onTimeChange: (time: TimeOfDay) => void;
  onLookChange: (look: LookChoice) => void;
}

export class DockComponent {
  readonly element: HTMLElement;
  readonly input: HTMLInputElement;
  readonly counter: HTMLElement;
  readonly revealButton: HTMLButtonElement;
  readonly categorySelect: HTMLSelectElement;
  readonly modelSelect: HTMLSelectElement;
  readonly photoButton: HTMLButtonElement;
  readonly variantRow: HTMLElement;
  readonly status: HTMLElement;
  readonly saveMenu: SaveMenuComponent;
  readonly photoRow: PhotoRowComponent;
  private readonly timeInputs = new Map<TimeOfDay, HTMLInputElement>();
  private currentObjectId: string;
  private currentVariantId: string;

  constructor(private readonly options: DockOptions) {
    this.currentObjectId = options.initialObjectId;
    this.currentVariantId = options.initialVariantId;

    const dock = document.createElement('section');
    dock.className = 'dock';
    dock.setAttribute('aria-label', 'Controls');

    // Row 1: link field, save menu, reveal button
    const row1 = document.createElement('div');
    row1.className = 'row link-row';

    const field = document.createElement('div');
    field.className = 'field';

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'link-input';
    this.input.value = options.initialText;
    this.input.maxLength = MAX_QR_CHARS;
    this.input.placeholder = 'Paste a link or text';
    this.input.spellcheck = false;
    this.input.autocapitalize = 'off';
    this.input.autocomplete = 'off';
    this.input.setAttribute('aria-label', 'Text or URL to encode');

    this.counter = document.createElement('span');
    this.counter.className = 'counter';
    this.updateCounter();

    this.input.addEventListener('input', () => {
      this.updateCounter();
      options.onTextInput(this.input.value);
    });

    this.input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') options.onEnterKey();
    });

    field.append(this.input, this.counter);

    this.saveMenu = new SaveMenuComponent(options.saveItems);

    this.revealButton = document.createElement('button');
    this.revealButton.type = 'button';
    this.revealButton.className = 'btn primary';
    this.revealButton.addEventListener('click', () => options.onRevealToggle());

    row1.append(field, this.saveMenu.element, this.revealButton);

    // Row 2: category/model pickers, photo button, variants, photo row, time of day
    const row2 = document.createElement('div');
    row2.className = 'row options-row';

    const pickers = document.createElement('div');
    pickers.className = 'pickers';

    this.categorySelect = document.createElement('select');
    this.categorySelect.className = 'picker';
    this.categorySelect.setAttribute('aria-label', 'Category');

    for (const category of getCategories()) {
      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = category.name;
      this.categorySelect.append(option);
    }

    this.modelSelect = document.createElement('select');
    this.modelSelect.className = 'picker';
    this.modelSelect.setAttribute('aria-label', 'Design');

    this.categorySelect.addEventListener('change', () => {
      const firstModel = getObjectsByCategory(this.categorySelect.value)[0];
      if (firstModel) {
        this.currentObjectId = firstModel.id;
        this.currentVariantId = firstModel.variants[0].id;
        this.syncPickers();
        this.renderVariants();
        options.onObjectChange(this.currentObjectId, this.currentVariantId);
      }
    });

    this.modelSelect.addEventListener('change', () => {
      const obj = getObject(this.modelSelect.value);
      this.currentObjectId = obj.id;
      this.currentVariantId = obj.variants[0].id;
      this.renderVariants();
      options.onObjectChange(this.currentObjectId, this.currentVariantId);
    });

    this.photoButton = document.createElement('button');
    this.photoButton.type = 'button';
    this.photoButton.className = 'btn ghost small';
    this.photoButton.innerHTML = `${ICONS.photo}<span>Your photo</span>`;
    this.photoButton.addEventListener('click', () => options.onChoosePhoto());

    pickers.append(this.categorySelect, this.modelSelect, this.photoButton);

    this.variantRow = document.createElement('div');
    this.variantRow.className = 'variants';
    this.variantRow.setAttribute('role', 'radiogroup');
    this.variantRow.setAttribute('aria-label', 'Color');

    this.photoRow = new PhotoRowComponent({
      onChangePhoto: () => options.onChoosePhoto(),
      onLookChange: (look) => options.onLookChange(look),
    });

    const times = document.createElement('div');
    times.className = 'segmented';
    times.setAttribute('role', 'radiogroup');
    times.setAttribute('aria-label', 'Time of day');

    for (const time of TIMES_OF_DAY) {
      const label = document.createElement('label');
      label.className = 'segment';
      label.title = TIME_LABELS[time];

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.className = 'sr-only';
      radio.name = 'time';
      radio.value = time;
      radio.checked = time === options.initialTime;
      radio.addEventListener('change', () => options.onTimeChange(time));

      this.timeInputs.set(time, radio);

      const icon = document.createElement('span');
      icon.className = 'segment-icon';
      icon.innerHTML = ICONS[time];

      const span = document.createElement('span');
      span.className = 'segment-text';
      span.textContent = TIME_LABELS[time];

      label.append(radio, icon, span);
      times.append(label);
    }

    row2.append(pickers, this.variantRow, this.photoRow.element, times);

    this.status = document.createElement('p');
    this.status.className = 'status';
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');

    dock.append(row1, row2, this.status);
    this.element = dock;

    this.syncPickers();
    this.renderVariants();
  }

  updateCounter(): void {
    const len = this.input.value.length;
    this.counter.textContent = `${len}/${MAX_QR_CHARS}`;
    this.counter.classList.toggle('over', len > MAX_QR_CHARS);
  }

  syncPickers(): void {
    if (this.currentObjectId === PHOTO_ID) return;
    const current = getObject(this.currentObjectId);
    this.categorySelect.value = current.category;

    const models = getObjectsByCategory(current.category);
    this.modelSelect.replaceChildren();
    for (const object of models) {
      const option = document.createElement('option');
      option.value = object.id;
      option.textContent = object.name;
      this.modelSelect.append(option);
    }
    this.modelSelect.value = current.id;
  }

  renderVariants(): void {
    if (this.currentObjectId === PHOTO_ID) return;
    const object = getObject(this.currentObjectId);
    this.variantRow.replaceChildren();

    for (const variant of object.variants) {
      const label = document.createElement('label');
      label.className = 'swatch-label';
      label.title = variant.name;

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.className = 'sr-only';
      radio.name = 'variant';
      radio.value = variant.id;
      radio.checked = variant.id === this.currentVariantId;

      radio.addEventListener('change', () => {
        this.currentVariantId = variant.id;
        this.options.onVariantChange(variant.id);
      });

      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.backgroundColor = variant.color;

      label.append(radio, swatch);
      this.variantRow.append(label);
    }
  }

  enterPhotoMode(): void {
    this.currentObjectId = PHOTO_ID;
    this.categorySelect.disabled = true;
    this.modelSelect.disabled = true;
    this.variantRow.hidden = true;
    this.photoRow.show();
  }

  leavePhotoMode(regularObjectId: string, regularVariantId: string): void {
    this.currentObjectId = regularObjectId;
    this.currentVariantId = regularVariantId;
    this.photoRow.hide();
    this.variantRow.hidden = false;
    this.categorySelect.disabled = false;
    this.modelSelect.disabled = false;
    this.syncPickers();
    this.renderVariants();
  }

  setTime(time: TimeOfDay): void {
    const radio = this.timeInputs.get(time);
    if (radio) radio.checked = true;
  }

  setStatus(message: string, isError = false): void {
    this.status.textContent = message;
    this.status.classList.toggle('error', isError);
  }
}
