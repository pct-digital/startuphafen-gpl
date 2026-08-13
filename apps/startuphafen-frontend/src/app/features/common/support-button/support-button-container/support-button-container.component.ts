import { Component, inject } from '@angular/core';
import { formatDateToGerman, TrpcService } from '@startuphafen/angular-common';
import { bytesToBase64 } from '@startuphafen/base64';
import {
  SupportButtonDisplayComponent,
  SupportTicketPayload,
} from '../support-button-display/support-button-display.component';

@Component({
  selector: 'sh-support-button-container',
  standalone: true,
  imports: [SupportButtonDisplayComponent],
  templateUrl: './support-button-container.component.html',
  styles: ``,
})
export class SupportButtonContainerComponent {
  trpc = inject(TrpcService);
  isSending = false;
  sendResult: 'success' | 'error' | null = null;

  async onSupportSubmitted(payload: SupportTicketPayload) {
    this.isSending = true;
    this.sendResult = null;

    try {
      const res = await this.trpc.client.GenericMail.sendSupport.mutate({
        body: `Antwort an: ${payload.email}, ${payload.phone}\n${payload.description}`,
        contentType: 'text',
        ...(payload.file && {
          attachments: [
            {
              filename: `problem_screenshot_${formatDateToGerman(
                new Date()
              )}.png`,
              base64: this.toBase64(payload.file),
            },
          ],
        }),
      });
      this.sendResult = res.success ? 'success' : 'error';
    } catch {
      this.sendResult = 'error';
    } finally {
      this.isSending = false;
    }
  }

  toBase64(data: Uint8Array | null) {
    if (data == null) return '';
    return bytesToBase64(data);
  }
}
