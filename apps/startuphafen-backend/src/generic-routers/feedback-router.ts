import { baseProcedure, router } from '@startuphafen/trpc-root';
import { z } from 'zod';
import { ServerConfig } from '../config';
import { MailClient } from '../features/common/mail';

export const buildFeedbackRouter = (serverConfig: ServerConfig) =>
  router({
    create: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
        feature: null,
      })
      .input(
        z.object({
          selection: z.number(),
          message: z.string(),
        })
      )
      .output(z.void())
      .mutation(async (req) => {
        const mailClient = new MailClient(serverConfig.mail);

        const result = await mailClient.sendMail({
          to: serverConfig.mail.feedbackRecipient,
          subject: 'Neues Feedback',
          content: {
            data: `Bewertung: ${
              ['Schlecht', 'Nicht Gut', 'In Ordnung', 'Gut', 'Sehr Gut'][
                req.input.selection
              ]
            }\nNachricht: ${req.input.message}`,
            type: 'text',
          },
        });

        if (result.success) return;
        console.error(result.message);
      }),
  });
