import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';
import { PopupService } from '@startuphafen/angular-common';

import {
  SupportButtonDisplayComponent,
  SupportTicketPayload,
} from './support-button-display.component';

describe('SupportButtonDisplayComponent', () => {
  let spectator: Spectator<SupportButtonDisplayComponent>;
  const createComponent = createComponentFactory({
    component: SupportButtonDisplayComponent,
    mocks: [PopupService],
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('should create', () => {
    expect(spectator.component).toBeTruthy();
  });

  describe('close', () => {
    it('should call popupService.closePopup', () => {
      const popupService = spectator.inject(PopupService);
      spectator.component.close();
      expect(popupService.closePopup).toHaveBeenCalled();
    });
  });

  describe('triggerFileInput', () => {
    it('should call click on the given input element', () => {
      const fakeInput = { click: jest.fn() } as unknown as HTMLInputElement;
      spectator.component.triggerFileInput(fakeInput);
      expect(fakeInput.click).toHaveBeenCalled();
    });
  });

  describe('onFileSelected', () => {
    function createFileEvent(file: Partial<File>): Event {
      return { target: { files: [file] } } as unknown as Event;
    }

    it('should accept a valid PNG file', () => {
      const file = { type: 'image/png', size: 1024, name: 'test.png' };
      spectator.component.onFileSelected(createFileEvent(file));
      expect(spectator.component.supportUpload).toBe(file);
      expect(spectator.component.error).toBeNull();
    });

    it('should accept a valid JPEG file', () => {
      const file = { type: 'image/jpeg', size: 2048, name: 'photo.jpeg' };
      spectator.component.onFileSelected(createFileEvent(file));
      expect(spectator.component.supportUpload).toBe(file);
    });

    it('should reject non-image file types', () => {
      const event = {
        target: {
          files: [{ type: 'application/pdf', size: 1024 }],
          value: 'fakepath',
        },
      } as unknown as Event;
      spectator.component.onFileSelected(event);
      expect(spectator.component.supportUpload).toBeNull();
      expect(spectator.component.error).toBe(
        'Bitte nur Bilddateien (PNG/JPG/JPEG) hochladen.'
      );
    });

    it('should reject files larger than 200MB', () => {
      const file = {
        type: 'image/png',
        size: 201 * 1024 * 1024,
        name: 'huge.png',
      };
      spectator.component.onFileSelected(createFileEvent(file));
      expect(spectator.component.error).toBe(
        'Die Datei ist zu groß (max. 200MB).'
      );
    });

    it('should do nothing when no files are selected', () => {
      const event = { target: { files: [] } } as unknown as Event;
      spectator.component.onFileSelected(event);
      expect(spectator.component.supportUpload).toBeNull();
      expect(spectator.component.error).toBeNull();
    });
  });

  describe('submit', () => {
    it('should emit supportSubmitted with form data and no file', async () => {
      const emitted: SupportTicketPayload[] = [];
      spectator.component.supportSubmitted.subscribe((v) => emitted.push(v));

      spectator.component.email = 'test@example.com';
      spectator.component.phone = '0123456';
      spectator.component.description = 'Something broke';

      await spectator.component.submit();

      expect(emitted).toHaveLength(1);
      expect(emitted[0]).toEqual({
        file: null,
        description: 'Something broke',
        email: 'test@example.com',
        phone: '0123456',
      });
    });

    it('should emit supportSubmitted with file data when a file is attached', async () => {
      const emitted: SupportTicketPayload[] = [];
      spectator.component.supportSubmitted.subscribe((v) => emitted.push(v));

      const fileContent = new Uint8Array([1, 2, 3]);
      const fakeFile = {
        name: 'screenshot.png',
        type: 'image/png',
        size: 3,
        arrayBuffer: () => Promise.resolve(fileContent.buffer),
      } as unknown as File;
      spectator.component.supportUpload = fakeFile;
      spectator.component.email = 'a@b.com';
      spectator.component.description = 'Bug';

      await spectator.component.submit();

      expect(emitted).toHaveLength(1);
      expect(emitted[0].file).toBeInstanceOf(Uint8Array);
      expect(emitted[0].description).toBe('Bug');
    });
  });
});
