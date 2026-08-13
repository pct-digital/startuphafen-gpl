import { Router } from '@angular/router';
import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { FormlyModule } from '@ngx-formly/core';
import {
  NavService,
  PctLoaderService,
  TrpcService,
} from '@startuphafen/angular-common';
import { KeycloakService } from 'keycloak-angular';
import { IdentificationUploadComponent } from './identification-upload.component';

describe('IdentificationUploadComponent', () => {
  const mockTrpcService = {
    client: {
      IdentificationDocuments: {
        getData: {
          query: jest.fn(),
        },
        upload: {
          mutate: jest.fn(),
        },
      },
    },
  };

  const mockLoaderService = {
    doWhileLoading: jest.fn().mockImplementation((_, f) => f()),
  };

  let spectator: Spectator<IdentificationUploadComponent>;
  const createComponent = createComponentFactory({
    component: IdentificationUploadComponent,
    imports: [FormlyModule.forRoot({})],
    mocks: [Router, NavService, KeycloakService],
    providers: [
      { provide: TrpcService, useValue: mockTrpcService },
      { provide: PctLoaderService, useValue: mockLoaderService },
    ],
  });

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create', () => {
    spectator = createComponent();
    expect(spectator.component).toBeTruthy();
  });

  it('should error if there is a missing identification document', async () => {
    mockTrpcService.client.IdentificationDocuments.getData.query
      .mockResolvedValueOnce({
        mimeType: 'image/png',
        data: new Uint8Array(),
      })
      .mockResolvedValueOnce(null);

    spectator = createComponent({
      props: {
        answers: {
          St82o_0: '12345678901',
          St83f_0: '1990-01-01',
          St82o_1: '12345678902',
          St83f_1: '1990-01-01',
        } as any,
      },
    });

    await spectator.component.ngOnInit();

    expect(spectator.component.form.errors).toEqual({
      identificationMissing: true,
    });
  });

  it('renders without crashing when the applicant has no birth date or name (sourced from BundID)', async () => {
    mockTrpcService.client.IdentificationDocuments.getData.query.mockResolvedValue(
      null
    );

    spectator = createComponent({
      props: {
        answers: {
          // First shareholder (applicant): only the Identifikationsnummer is
          // collected; name and birth date come from BundID.
          St82o_0: '12345678901',
          // Second shareholder (co-founder) has the full data set.
          St82o_1: '12345678902',
          St83d_1: 'Erika',
          St83b_1: 'Mustermann',
          St83f_1: '1990-01-01',
        } as any,
      },
    });

    await spectator.component.ngOnInit();
    // Rendering used to throw on the applicant's undefined birth date.
    expect(() => spectator.detectChanges()).not.toThrow();

    expect(spectator.component.people[0]).toEqual({
      index: 0,
      name: 'Antragsteller',
      taxId: '12345678901',
      birthDate: undefined,
    });
    expect(spectator.component.people[1]).toEqual({
      index: 1,
      name: 'Erika Mustermann',
      taxId: '12345678902',
      birthDate: '1990-01-01',
    });
  });

  it('resets the file input value after a selection so the same file can be picked again', async () => {
    mockTrpcService.client.IdentificationDocuments.getData.query.mockResolvedValue(
      null
    );
    mockTrpcService.client.IdentificationDocuments.upload.mutate.mockResolvedValue(
      undefined
    );

    spectator = createComponent({
      props: {
        projectId: 1,
        answers: {
          St82o_0: '12345678901',
        } as any,
      },
    });
    await spectator.component.ngOnInit();

    spectator.component.selectFile(spectator.component.people[0]);
    const file = new File(['x'], 'id.png', { type: 'image/png' });
    file.arrayBuffer = jest.fn().mockResolvedValue(new Uint8Array([1]).buffer);
    // Browsers leave the chosen path on the input; if it isn't cleared, picking
    // the same file again fires no 'change' event.
    const target = { files: [file], value: 'C:\\fakepath\\id.png' };
    await spectator.component.onFileSelected({
      target,
    } as unknown as Event);

    expect(target.value).toBe('');
  });

  it('should not error if all identification documents are present', async () => {
    mockTrpcService.client.IdentificationDocuments.getData.query.mockResolvedValue(
      {
        mimeType: 'image/png',
        data: new Uint8Array(),
      }
    );

    spectator = createComponent({
      props: {
        answers: {
          St82o_0: '12345678901',
          St83f_0: '1990-01-01',
          St82o_1: '12345678902',
          St83f_1: '1990-01-01',
        } as any,
      },
    });

    await spectator.component.ngOnInit();

    expect(spectator.component.form.errors).toBeNull();
  });

  it('skips the first shareholder (logged-in applicant) in the KapG flow', async () => {
    // Only the second shareholder gets a document; the first one (applicant)
    // must not be required.
    mockTrpcService.client.IdentificationDocuments.getData.query.mockResolvedValue(
      {
        mimeType: 'image/png',
        data: new Uint8Array(),
      }
    );

    spectator = createComponent({
      props: {
        catalogueId: 'kapg',
        answers: {
          St82o_0: '12345678901',
          St83f_0: '1990-01-01',
          St82o_1: '12345678902',
          St83f_1: '1990-01-01',
        } as any,
      },
    });

    await spectator.component.ngOnInit();

    // Applicant (index 0) is excluded, only the extra shareholder remains.
    expect(spectator.component.people.map((p) => p.taxId)).toEqual([
      '12345678902',
    ]);
    expect(spectator.component.form.errors).toBeNull();
  });

  it('does not skip a natural person when the first KapG shareholder is a Firma', async () => {
    // Index 0 is a Firma (no St82o_0), so only the natural persons at index 1
    // and 2 exist. The applicant row is index 0, so neither natural person may
    // be skipped - both must still upload a document.
    mockTrpcService.client.IdentificationDocuments.getData.query.mockResolvedValue(
      {
        mimeType: 'image/png',
        data: new Uint8Array(),
      }
    );

    spectator = createComponent({
      props: {
        catalogueId: 'kapg',
        answers: {
          St82o_1: '12345678902',
          St83f_1: '1990-01-01',
          St82o_2: '12345678903',
          St83f_2: '1990-01-01',
        } as any,
      },
    });

    await spectator.component.ngOnInit();

    expect(spectator.component.people.map((p) => p.taxId)).toEqual([
      '12345678902',
      '12345678903',
    ]);
    expect(spectator.component.form.errors).toBeNull();
  });

  it('does not require a document for the KapG applicant even when theirs is missing', async () => {
    mockTrpcService.client.IdentificationDocuments.getData.query.mockResolvedValue(
      {
        mimeType: 'image/png',
        data: new Uint8Array(),
      }
    );

    spectator = createComponent({
      props: {
        catalogueId: 'kapg',
        answers: {
          St82o_0: '12345678901',
          St83f_0: '1990-01-01',
          St82o_1: '12345678902',
          St83f_1: '1990-01-01',
        } as any,
      },
    });

    await spectator.component.ngOnInit();

    expect(spectator.component.form.errors).toBeNull();
  });
});
