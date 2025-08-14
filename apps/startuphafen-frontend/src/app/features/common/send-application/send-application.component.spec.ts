import { byTestId } from '@ngneat/spectator';
import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { SendApplicationComponent } from './send-application.component';

describe('SendApplicationComponent', () => {
  let spectator: Spectator<SendApplicationComponent>;

  const createComponent = createComponentFactory({
    component: SendApplicationComponent,
    shallow: true,
  });

  beforeEach(() => {
    spectator = createComponent({
      props: {
        applicationType: 'elster',
        content: 'Test content',
        title: 'Test title',
        subtitle: 'Test subtitle',
      },
    });
  });

  it('should create', () => {
    expect(spectator.component).toBeTruthy();
  });

  describe('Input properties', () => {
    it('should display the title correctly', () => {
      const titleElement = spectator.query(
        byTestId('send-application-card-title')
      );
      expect(titleElement?.textContent).toBe('Test title');
    });

    it('should display the subtitle correctly', () => {
      const subtitleElement = spectator.query(
        byTestId('send-application-card-subtitle')
      );
      expect(subtitleElement?.textContent?.trim()).toBe(
        'Test subtitle: Finanzamt'
      );
    });

    it('should display the content correctly', () => {
      const contentElement = spectator.query(
        byTestId('send-application-card-content')
      );
      expect(contentElement?.textContent?.trim()).toBe('Test content');
    });
  });

  describe('Button text and emissions', () => {
    it('should show "An das Finanzamt senden" for elster type', () => {
      const sendButton = spectator.query(
        byTestId('send-application-send-data-btn')
      );
      expect(sendButton?.textContent?.trim()).toContain(
        'An das Finanzamt senden'
      );
    });

    it('should show "An das Gewerbeamt senden" for gewerbeamt type', () => {
      spectator.setInput('applicationType', 'gewerbeamt');
      spectator.detectChanges();

      const sendButton = spectator.query(
        byTestId('send-application-send-data-btn')
      );
      expect(sendButton?.textContent?.trim()).toContain(
        'An das Gewerbeamt senden'
      );
    });

    it('should emit sendData event when send button is clicked', () => {
      const sendSpy = jest.spyOn(spectator.component.sendData, 'emit');

      const sendButton = spectator.query(
        byTestId('send-application-send-data-btn')
      );
      spectator.click(sendButton!);

      expect(sendSpy).toHaveBeenCalled();
    });

    it('should emit downloadData event when download button is clicked', () => {
      const downloadSpy = jest.spyOn(spectator.component.downloadData, 'emit');

      const downloadButton = spectator.query(
        byTestId('send-application-donwload-data-btn')
      );
      spectator.click(downloadButton!);

      expect(downloadSpy).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper tabindex on buttons', () => {
      const sendButton = spectator.query(
        byTestId('send-application-send-data-btn')
      );
      const downloadButton = spectator.query(
        byTestId('send-application-donwload-data-btn')
      );

      expect(sendButton?.getAttribute('tabindex')).toBe('1');
      expect(downloadButton?.getAttribute('tabindex')).toBe('0');
    });

    it('should have alt text for icons', () => {
      const images = spectator.queryAll('img');
      for (const img of images) {
        expect(img.getAttribute('alt')).toBeTruthy();
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle null applicationType', () => {
      spectator.setInput('applicationType', null);
      spectator.detectChanges();

      const sendButton = spectator.query(
        byTestId('send-application-send-data-btn')
      );
      expect(sendButton?.textContent?.trim()).toContain('An das  senden');
    });

    it('should handle null content, title, and subtitle', () => {
      spectator.setInput({
        content: null,
        title: null,
        subtitle: null,
      });
      spectator.detectChanges();

      const titleElement = spectator.query(
        byTestId('send-application-card-title')
      );
      const subtitleElement = spectator.query(
        byTestId('send-application-card-subtitle')
      );
      const contentElement = spectator.query(
        byTestId('send-application-card-content')
      );

      expect(titleElement?.textContent?.trim()).toBe('');
      expect(subtitleElement?.textContent?.trim()).toBe('');
      expect(contentElement?.textContent?.trim()).toBe('');
    });
  });
});
