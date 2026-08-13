import {
  Spectator,
  byTestId,
  createComponentFactory,
} from '@ngneat/spectator/jest';
import { PctLoaderService, TrpcService } from '@startuphafen/angular-common';
import { KeycloakService } from 'keycloak-angular';
import { DocumentUploadComponent } from './document-upload.component';

const mockLoaderService = {
  doWhileLoading: jest.fn((_key: string, fn: () => Promise<unknown>) => fn()),
};

const mockTrpcService = {
  client: {
    Project: {
      update: {
        mutate: jest.fn().mockResolvedValue({}),
      },
      pickFiltered: {
        query: jest.fn().mockResolvedValue([{ progress: 0 }]),
      },
    },
    UserDocuments: {
      listByProject: {
        query: jest.fn().mockResolvedValue([]),
      },
    },
  },
};

describe('DocumentUploadComponent', () => {
  let spectator: Spectator<DocumentUploadComponent>;
  const createComponent = createComponentFactory({
    component: DocumentUploadComponent,
    mocks: [KeycloakService],
    providers: [
      { provide: PctLoaderService, useValue: mockLoaderService },
      { provide: TrpcService, useValue: mockTrpcService },
    ],
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('should create', () => {
    expect(spectator.component).toBeTruthy();
  });

  it('should render upload buttons', () => {
    expect(spectator.query(byTestId('upload-contract-btn'))).toExist();
    expect(spectator.query(byTestId('upload-shareholder-btn'))).toExist();
  });

  it('should accept valid PDF', () => {
    const file = new File(['test'], 'contract.pdf', {
      type: 'application/pdf',
    });
    const event = {
      target: { files: [file], value: '' },
    } as any;

    spectator.component.onFileSelected(event, 'contract');

    expect(spectator.component.contractFile).toBe(file);
  });

  it('should reject non-PDF with error', () => {
    const file = new File(['test'], 'document.txt', { type: 'text/plain' });
    const event = {
      target: { files: [file], value: '' },
    } as any;

    spectator.component.onFileSelected(event, 'contract');

    expect(spectator.component.error).toBe('Bitte nur PDF-Dateien hochladen.');
  });

  it('should emit true when all required files selected', () => {
    const file = new File(['test'], 'document.pdf', {
      type: 'application/pdf',
    });
    const event = {
      target: { files: [file], value: '' },
    } as any;

    let emittedValue = false;
    spectator.component.completionChange.subscribe((value: boolean) => {
      emittedValue = value;
    });

    spectator.component.onFileSelected(event, 'contract');
    spectator.component.onFileSelected(event, 'shareholder');
    spectator.component.onFileSelected(event, 'hrg');

    expect(emittedValue).toBe(true);
  });
});
