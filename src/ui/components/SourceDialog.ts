import { BlockedImageError, fetchPhotoFile, parseImageUrl, proxiedUrl } from '../photoUrl';
import { PhotoReadError } from '../photoSession';
import { ICONS } from '../icons';

export interface SourceDialogOptions {
  onFileSelect: () => void;
  onPhotoLoaded: (file: File) => Promise<void>;
  onDismiss: () => void;
}

export class SourceDialogComponent {
  readonly element: HTMLDialogElement;
  readonly urlInput: HTMLInputElement;
  readonly urlError: HTMLElement;

  constructor(options: SourceDialogOptions) {
    const dialog = document.createElement('dialog');
    dialog.className = 'info source-dialog';
    dialog.setAttribute('aria-labelledby', 'source-title');
    let chosen = false;

    const head = document.createElement('div');
    head.className = 'info-head';

    const title = document.createElement('h2');
    title.id = 'source-title';
    title.textContent = 'Choose a photo';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'icon-btn';
    close.innerHTML = ICONS.close;
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', () => dialog.close());
    head.append(title, close);

    const upload = document.createElement('button');
    upload.type = 'button';
    upload.className = 'btn ghost source-upload';
    upload.innerHTML = `${ICONS.upload}<span>Upload from this device</span>`;
    upload.addEventListener('click', () => {
      chosen = true;
      dialog.close();
      options.onFileSelect();
    });

    const form = document.createElement('form');
    form.className = 'source-form';
    const label = document.createElement('label');
    label.className = 'source-label';
    label.textContent = 'Or use a public image link';

    this.urlInput = document.createElement('input');
    this.urlInput.type = 'url';
    this.urlInput.inputMode = 'url';
    this.urlInput.placeholder = 'https://example.com/picture.jpg';
    this.urlInput.autocomplete = 'off';
    this.urlInput.spellcheck = false;
    this.urlInput.autocapitalize = 'off';
    this.urlInput.className = 'link-input source-input';
    label.append(this.urlInput);

    const load = document.createElement('button');
    load.type = 'submit';
    load.className = 'btn primary';
    load.textContent = 'Load image';

    this.urlError = document.createElement('p');
    this.urlError.className = 'source-error';
    this.urlError.setAttribute('role', 'alert');
    form.append(label, load);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void (async () => {
        this.urlError.textContent = '';
        load.disabled = true;
        load.textContent = 'Loading…';
        try {
          const original = parseImageUrl(this.urlInput.value);
          let file: File;
          try {
            file = await fetchPhotoFile(original);
          } catch (error) {
            if (!(error instanceof BlockedImageError)) throw error;
            try {
              file = await fetchPhotoFile(proxiedUrl(original), fetch, original);
            } catch {
              throw new PhotoReadError('Could not load that image. Check that the link is public and points straight to a picture.');
            }
          }
          chosen = true;
          dialog.close();
          await options.onPhotoLoaded(file);
        } catch (error) {
          this.urlError.textContent = error instanceof PhotoReadError ? error.message : 'Could not load that image.';
        } finally {
          load.disabled = false;
          load.textContent = 'Load image';
        }
      })();
    });

    const note = document.createElement('p');
    note.className = 'info-note';
    note.textContent = 'Your browser fetches the image straight from its site. If that site does not allow it, the link is retried through the images.weserv.nl proxy, which then sees the link. Nothing goes through our servers.';

    dialog.append(head, upload, form, this.urlError, note);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      if (!chosen) options.onDismiss();
      chosen = false;
    });

    this.element = dialog;
  }

  show(): void {
    this.urlError.textContent = '';
    this.element.showModal();
  }

  close(): void {
    this.element.close();
  }
}
