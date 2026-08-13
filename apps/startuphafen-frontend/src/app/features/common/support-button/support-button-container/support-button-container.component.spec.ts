import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';
import { TrpcService } from '@startuphafen/angular-common';

import { SupportTicketPayload } from '../support-button-display/support-button-display.component';
import { SupportButtonContainerComponent } from './support-button-container.component';

const mockMutate = jest.fn();

describe('SupportButtonContainerComponent', () => {
  let spectator: Spectator<SupportButtonContainerComponent>;
  const createComponent = createComponentFactory({
    component: SupportButtonContainerComponent,
    providers: [
      {
        provide: TrpcService,
        useValue: {
          client: {
            GenericMail: {
              sendSupport: { mutate: mockMutate },
            },
          },
        },
      },
    ],
  });

  beforeEach(() => {
    mockMutate.mockReset();
    spectator = createComponent();
  });

  it('should create', () => {
    expect(spectator.component).toBeTruthy();
  });

  describe('toBase64', () => {
    it('should return empty string for null', () => {
      expect(spectator.component.toBase64(null)).toBe('');
    });

    it('should return base64 string for Uint8Array', () => {
      const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const result = spectator.component.toBase64(data);
      expect(result).toBe('SGVsbG8=');
    });
  });

  describe('onSupportSubmitted', () => {
    const payload: SupportTicketPayload = {
      file: null,
      description: 'Something broke',
      email: 'test@example.com',
      phone: '0123',
    };

    it('should set isSending while request is in flight', async () => {
      let resolvePromise!: (v: any) => void;
      mockMutate.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        })
      );

      const promise = spectator.component.onSupportSubmitted(payload);
      expect(spectator.component.isSending).toBe(true);

      resolvePromise({ success: true });
      await promise;

      expect(spectator.component.isSending).toBe(false);
    });

    it('should set sendResult to success on successful mutation', async () => {
      mockMutate.mockResolvedValue({ success: true });

      await spectator.component.onSupportSubmitted(payload);

      expect(spectator.component.sendResult).toBe('success');
      expect(spectator.component.isSending).toBe(false);
    });

    it('should set sendResult to error when mutation returns success=false', async () => {
      mockMutate.mockResolvedValue({ success: false });

      await spectator.component.onSupportSubmitted(payload);

      expect(spectator.component.sendResult).toBe('error');
    });

    it('should set sendResult to error when mutation throws', async () => {
      mockMutate.mockRejectedValue(new Error('Network error'));

      await spectator.component.onSupportSubmitted(payload);

      expect(spectator.component.sendResult).toBe('error');
      expect(spectator.component.isSending).toBe(false);
    });

    it('should call mutate with correctly formatted body and attachment', async () => {
      mockMutate.mockResolvedValue({ success: true });
      const filePayload: SupportTicketPayload = {
        file: new Uint8Array([1, 2, 3]),
        description: 'Bug report',
        email: 'a@b.com',
        phone: '555',
      };

      await spectator.component.onSupportSubmitted(filePayload);

      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('a@b.com'),
          contentType: 'text',
          attachments: expect.arrayContaining([
            expect.objectContaining({
              base64: expect.any(String),
            }),
          ]),
        })
      );
      // base64 should not be empty when file is provided
      const callArg = mockMutate.mock.calls[0][0];
      expect(callArg.attachments[0].base64.length).toBeGreaterThan(0);
    });
  });
});
