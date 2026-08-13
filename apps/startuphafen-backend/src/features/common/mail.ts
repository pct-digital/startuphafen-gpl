import nodemailer from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';

export interface MailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from?: string;
  noSSL?: boolean;
}

export interface MailDescription {
  to: string;
  from?: string;
  subject: string;
  content:
    | {
        data: string;
        type: 'text';
      }
    | {
        data: string;
        type: 'html';
      };
  attachments?: {
    filename: string;
    content: Buffer;
  }[];
  replyTo?: string;
  cc?: string;
  bcc?: string;
}

export interface SendMailResponse {
  success: boolean;
  message: string;
}

export class MailClient {
  private mailTransport: nodemailer.Transporter<any>;

  constructor(private mailConfig: MailConfig) {
    const options: any = {
      host: this.mailConfig.host,
      port: this.mailConfig.port,
      auth: {
        user: this.mailConfig.user,
        pass: this.mailConfig.password,
      },
    };

    if (mailConfig.noSSL) {
      options.secure = false;
      options.tls = {
        rejectUnauthorized: false,
      };
    }

    this.mailTransport = nodemailer.createTransport({
      ...options,
    });
  }
  private createMessage(request: MailDescription) {
    const msg: Mail.Options = {
      to: request.to,
      from: request.from ?? this.mailConfig.from ?? this.mailConfig.user,
      subject: request.subject,
    };

    if (request.attachments != null) {
      msg.attachments = request.attachments;
    }

    if (request.replyTo) {
      msg.replyTo = request.replyTo;
    }

    if (request.content.type === 'html') {
      msg.html = request.content.data;
    } else {
      msg.text = request.content.data;
    }

    //https://stackoverflow.com/questions/28527561/sending-email-to-multiple-recipients-via-nodemailer
    if (request.cc) {
      msg.cc = request.cc;
    }
    if (request.bcc) {
      msg.bcc = request.bcc;
    }

    return msg;
  }

  private createCopySubject(msg: Mail.Options) {
    let result = '[Kopie von Mail an ' + msg.to;
    if (msg.cc != null) {
      result += ', CC ' + msg.cc;
    }
    if (msg.bcc != null) {
      result += ', BCC ' + msg.bcc;
    }
    result += '] ' + msg.subject;
    return result;
  }

  private splitRecipients(value: string | undefined): string[] {
    if (!value) return [];
    return value
      .split(/[;,]/)
      .map((recipient) => recipient.trim().toLowerCase())
      .filter((recipient) => recipient.length > 0);
  }

  private normalizeAddress(value: string): string {
    return value.trim().toLowerCase();
  }

  private extractRecipientAddress(value: unknown): string | null {
    if (typeof value === 'string') {
      return this.normalizeAddress(value);
    }

    if (typeof value !== 'object' || value === null || !('address' in value)) {
      return null;
    }

    const address = value.address;
    if (typeof address !== 'string') {
      return null;
    }

    return this.normalizeAddress(address);
  }

  private getRejectedRecipients(info: unknown): string[] {
    if (typeof info !== 'object' || info === null || !('rejected' in info)) {
      return [];
    }

    const rejectedValue = info.rejected;
    if (!Array.isArray(rejectedValue)) {
      return [];
    }

    const rejectedRecipients: string[] = [];
    for (const entry of rejectedValue) {
      const address = this.extractRecipientAddress(entry);
      if (address) {
        rejectedRecipients.push(address);
      }
    }

    return rejectedRecipients;
  }

  private getIntendedRecipients(request: MailDescription): Set<string> {
    return new Set([
      ...this.splitRecipients(request.to),
      ...this.splitRecipients(request.cc),
      ...this.splitRecipients(request.bcc),
    ]);
  }

  async sendMail(request: MailDescription): Promise<SendMailResponse> {
    const mt = this.mailTransport;
    const msg = this.createMessage(request);
    try {
      const info = await mt.sendMail(msg);
      const rejectedRecipients = this.getRejectedRecipients(info);
      if (rejectedRecipients.length > 0) {
        const intendedRecipients = this.getIntendedRecipients(request);
        const relevantRejectedRecipients = rejectedRecipients.filter((recipient) =>
          intendedRecipients.has(recipient)
        );
        const rejectionList =
          relevantRejectedRecipients.length > 0
            ? relevantRejectedRecipients
            : rejectedRecipients;

        return {
          success: false,
          message: `Rejected recipients: ${rejectionList.join(', ')}`,
        };
      }

      // Always send a copy to our own postbox so we have a record of everything we sent out
      await mt.sendMail({
        ...msg,
        subject: this.createCopySubject(msg),
        to: msg.from,
        cc: undefined,
        bcc: undefined,
      });
    } catch (error: any) {
      console.log('Error sending mail!', msg, error);
      const errResponse =
        error.response != null ? JSON.stringify(error.response) : null;
      const errorMessage = errResponse || error.name || 'unknown error!';
      return {
        success: false,
        message: errorMessage,
      };
    }

    return {
      success: true,
      message: 'Mail sent',
    };
  }
}
