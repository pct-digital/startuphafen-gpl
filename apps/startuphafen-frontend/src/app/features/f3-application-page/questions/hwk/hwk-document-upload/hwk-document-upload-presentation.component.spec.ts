import {
  byTestId,
  createComponentFactory,
  Spectator,
} from '@ngneat/spectator/jest';
import { HwkDocumentUploadPresentationComponent } from './hwk-document-upload-presentation.component';

describe('HwkDocumentUploadPresentationComponent', () => {
  let spectator: Spectator<HwkDocumentUploadPresentationComponent>;

  const createComponent = createComponentFactory({
    component: HwkDocumentUploadPresentationComponent,
  });

  it('should create', () => {
    spectator = createComponent();
    expect(spectator.component).toBeTruthy();
  });

  it('shows bundid hint when upload is not allowed', () => {
    spectator = createComponent({
      props: {
        title: 'Test Upload',
        description: 'Beschreibung',
        canUpload: false,
      },
    });

    expect(spectator.element.textContent).toContain('Test Upload');
    expect(spectator.element.textContent).toContain('BundID');
    expect(spectator.query(byTestId('hwk-upload-select'))).toBeNull();
  });

  it('emits selected file', () => {
    spectator = createComponent({
      props: {
        canUpload: true,
      },
    });

    const file = new File(['content'], 'doc.pdf', {
      type: 'application/pdf',
    });
    const spy = jest.spyOn(spectator.component.fileSelected, 'emit');
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', {
      value: [file],
    });
    const event = new Event('change');
    Object.defineProperty(event, 'target', {
      value: input,
    });

    spectator.component.onFileChange(event);

    expect(spy).toHaveBeenCalledWith(file);
  });

  it('shows the required upload hint and validation error', () => {
    spectator = createComponent({
      props: {
        canUpload: true,
        isRequired: true,
        requiredHint:
          'Bitte lade Deinen Qualifikationsnachweis als PDF hoch, bevor Du fortfährst.',
        showRequiredError: true,
      },
    });

    expect(spectator.element.textContent).toContain(
      'Bitte lade Deinen Qualifikationsnachweis als PDF hoch, bevor Du fortfährst.'
    );
    expect(spectator.query(byTestId('hwk-upload-required-error'))).toExist();
  });
});
