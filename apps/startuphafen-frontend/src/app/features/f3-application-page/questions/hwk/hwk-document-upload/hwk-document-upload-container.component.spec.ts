import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { PctLoaderService, TrpcService } from '@startuphafen/angular-common';
import { createMockTrpcClient } from '@startuphafen/spectator-help';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { AppRouter } from 'apps/startuphafen-backend/src/router';
import { KeycloakService } from 'keycloak-angular';
import { SimpleChange } from '@angular/core';
import { HwkDocumentUploadContainerComponent } from './hwk-document-upload-container.component';

describe('HwkDocumentUploadContainerComponent', () => {
  let spectator: Spectator<HwkDocumentUploadContainerComponent>;

  const createComponent = createComponentFactory({
    component: HwkDocumentUploadContainerComponent,
    mocks: [TrpcService, PctLoaderService, KeycloakService],
    detectChanges: false,
  });

  const setupCommonMocks = (roles: string[]) => {
    jest
      .spyOn(spectator.inject(KeycloakService), 'getUserRoles')
      .mockReturnValue(roles);

    jest
      .spyOn(spectator.inject(PctLoaderService), 'doWhileLoading')
      .mockImplementation(async (_key, work) => await work());
  };

  it('loads documents by case on init', async () => {
    spectator = createComponent({
      props: {
        projectId: 100,
        documentCase: 'hwk_hr_extract',
      },
    });

    const listByCase = jest.fn().mockResolvedValue([
      {
        id: 1,
        filename: 'hr-extract.pdf',
        mimeType: 'application/pdf',
        createdAt: new Date('2026-02-18T10:00:00.000Z'),
        projectId: 100,
        documentCase: 'hwk_hr_extract',
      },
    ]);

    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      UserDocuments: {
        listByCase: {
          query: listByCase,
        },
      },
    });

    setupCommonMocks(['bundID-low']);

    spectator.detectChanges();
    await spectator.fixture.whenStable();

    expect(listByCase).toHaveBeenCalledWith({
      projectId: 100,
      documentCase: 'hwk_hr_extract',
    });
    expect(spectator.component.documents).toHaveLength(1);
  });

  it('emits the current document count after loading documents', async () => {
    spectator = createComponent({
      props: {
        projectId: 100,
        documentCase: 'hwk_qualification_proof',
      },
    });

    const listByCase = jest.fn().mockResolvedValue([
      {
        id: 1,
        filename: 'qualification.pdf',
        mimeType: 'application/pdf',
        createdAt: new Date('2026-02-18T10:00:00.000Z'),
        projectId: 100,
        documentCase: 'hwk_qualification_proof',
      },
    ]);

    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      UserDocuments: {
        listByCase: {
          query: listByCase,
        },
      },
    });

    setupCommonMocks(['bundID-low']);

    const documentsChangedSpy = jest.spyOn(
      spectator.component.documentsChanged,
      'emit'
    );

    spectator.detectChanges();
    await spectator.fixture.whenStable();

    expect(documentsChangedSpy).toHaveBeenCalledWith(1);
  });

  it('emits null when the current session cannot verify upload documents', async () => {
    spectator = createComponent({
      props: {
        projectId: 100,
        documentCase: 'hwk_qualification_proof',
      },
    });

    const listByCase = jest.fn();
    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      UserDocuments: {
        listByCase: {
          query: listByCase,
        },
      },
    });

    setupCommonMocks(['login']);

    const documentsChangedSpy = jest.spyOn(
      spectator.component.documentsChanged,
      'emit'
    );

    spectator.detectChanges();
    await spectator.fixture.whenStable();

    expect(listByCase).not.toHaveBeenCalled();
    expect(documentsChangedSpy).toHaveBeenCalledWith(null);
  });

  it('does not emit document state before roles are initialized', async () => {
    spectator = createComponent({
      props: {
        projectId: 100,
        documentCase: 'hwk_qualification_proof',
      },
    });

    const documentsChangedSpy = jest.spyOn(
      spectator.component.documentsChanged,
      'emit'
    );

    await spectator.component.ngOnChanges({
      projectId: new SimpleChange(null, 100, true),
    });

    expect(documentsChangedSpy).not.toHaveBeenCalled();
  });

  it('rejects non-pdf files', async () => {
    spectator = createComponent({
      props: {
        projectId: 100,
      },
    });

    const listByCase = jest.fn().mockResolvedValue([]);
    const upload = jest.fn();

    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      UserDocuments: {
        listByCase: {
          query: listByCase,
        },
        upload: {
          mutate: upload,
        },
      },
    });

    setupCommonMocks(['bundID-high']);

    spectator.detectChanges();
    await spectator.fixture.whenStable();

    await spectator.component.onFileSelected(
      new File(['not a pdf'], 'readme.txt', {
        type: 'text/plain',
      })
    );

    expect(spectator.component.error).toBe('Bitte nur PDF-Dateien hochladen.');
    expect(upload).not.toHaveBeenCalled();
  });

  it('uploads and deletes documents via trpc', async () => {
    spectator = createComponent({
      props: {
        projectId: 100,
        documentCase: 'hwk_qualification_proof',
      },
    });

    const listByCase = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 2,
          filename: 'qualification.pdf',
          mimeType: 'application/pdf',
          createdAt: new Date('2026-02-18T10:00:00.000Z'),
          projectId: 100,
          documentCase: 'hwk_qualification_proof',
        },
      ])
      .mockResolvedValueOnce([]);

    const upload = jest.fn().mockResolvedValue({
      id: 2,
      filename: 'qualification.pdf',
      mimeType: 'application/pdf',
      createdAt: new Date('2026-02-18T10:00:00.000Z'),
      projectId: 100,
      documentCase: 'hwk_qualification_proof',
    });
    const deleteMutation = jest.fn().mockResolvedValue(2);

    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      UserDocuments: {
        listByCase: {
          query: listByCase,
        },
        upload: {
          mutate: upload,
        },
        delete: {
          mutate: deleteMutation,
        },
      },
    });

    setupCommonMocks(['bundID-high']);

    spectator.detectChanges();
    await spectator.fixture.whenStable();

    const uploadFile = new File(['abc'], 'qualification.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(uploadFile, 'arrayBuffer', {
      value: async () => new Uint8Array([1, 2, 3]).buffer,
    });

    await spectator.component.onFileSelected(uploadFile);

    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: 'qualification.pdf',
        projectId: 100,
        documentCase: 'hwk_qualification_proof',
      })
    );

    await spectator.component.onDeleteRequested(2);

    expect(deleteMutation).toHaveBeenCalledWith({
      docId: 2,
      projectId: 100,
    });
  });

  it('shows role hint when user has neither bundID-low nor bundID-high', async () => {
    spectator = createComponent({
      props: {
        projectId: 100,
      },
    });

    const listByCase = jest.fn();
    spectator.inject(TrpcService).client = createMockTrpcClient<AppRouter>({
      UserDocuments: {
        listByCase: {
          query: listByCase,
        },
      },
    });

    setupCommonMocks(['login']);

    spectator.detectChanges();
    await spectator.fixture.whenStable();

    expect(spectator.component.canUpload).toBe(false);
    expect(listByCase).not.toHaveBeenCalled();
    expect(spectator.element.textContent).toContain('BundID');
  });
});
