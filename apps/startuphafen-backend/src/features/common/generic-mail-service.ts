import { ServerConfig } from '../../config';
import { MailClient } from './mail';

export interface GenericMailRequest {
  to: string;
  subject: string;
  body: string;
  contentType: 'text' | 'html';
  cc?: string;
  bcc?: string;
  replyTo?: string;
  attachments?: {
    filename: string;
    content: Buffer;
  }[];
}

export interface GenericMailResult {
  success: boolean;
  message: string;
}

export class GenericMailService {
  private mailClient: MailClient;

  constructor(config: ServerConfig) {
    this.mailClient = new MailClient(config.mail);
  }

  async send(request: GenericMailRequest): Promise<GenericMailResult> {
    const result = await this.mailClient.sendMail({
      to: request.to,
      subject: request.subject,
      content: {
        data: request.body,
        type: request.contentType,
      },
      cc: request.cc,
      bcc: request.bcc,
      replyTo: request.replyTo,
      attachments: request.attachments,
    });

    if (result.success) {
      console.info('Generic mail sent', {
        to: request.to,
        subject: request.subject,
      });
      return { success: true, message: result.message };
    }

    console.warn('Generic mail send failed', {
      to: request.to,
      subject: request.subject,
      error: result.message,
    });

    console.error(new Error('Generic mail send failed'));

    return { success: false, message: result.message };
  }
}
