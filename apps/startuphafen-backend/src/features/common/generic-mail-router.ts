import {
  GenericMailOutputSchema,
  SupportMailInput,
} from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { ServerConfig } from '../../config';
import { GenericMailService } from './generic-mail-service';

export function buildGenericMailRouter(serverConfig: ServerConfig) {
  const mailService = new GenericMailService(serverConfig);

  return router({
    sendSupport: baseProcedure
      .meta({
        requiredRolesAny: ['bundID-low', 'bundID-high'],
        feature: null,
      })
      .input(SupportMailInput)
      .output(GenericMailOutputSchema)
      .mutation(async (req) => {
        const bufferAttachments = req.input.attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.base64, 'base64'),
        }));

        return mailService.send({
          to: serverConfig.mail.supportRecipient,
          subject: `Support Ticket ${new Date().toLocaleDateString('de-DE')}`,
          body: req.input.body,
          contentType: req.input.contentType,
          cc: serverConfig.mail.supportCC,
          attachments: bufferAttachments,
        });
      }),
  });
}
