import {
  ArticleCategory,
  Artikel,
  Contact,
  FAQItem,
  LoginPageTexts,
  ShUser,
  WebsiteText,
} from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { z } from 'zod';
import { ServerConfig } from '../../config';
import { CMSTool } from './cms-tool';

const articleCategoryContentNameSchema = z.literal('article-categories');
const artikelContentNameSchema = z.literal('test-artikels');
const faqItemContentNameSchema = z.literal('test-faqs');

export function buildCMSRouter(config: ServerConfig) {
  const cmsTool = new CMSTool(config);

  return router({
    getCategories: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
        feature: null,
      })
      .input(z.object({ name: articleCategoryContentNameSchema }))
      .output(z.array(ArticleCategory))
      .query(async (req) => {
        const res: ArticleCategory[] = await cmsTool.getContentList(
          req.input.name
        );
        return res;
      }),
    searchArticles: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
        feature: null,
      })
      .input(
        z.object({
          name: artikelContentNameSchema,
          searchString: z.string(),
        })
      )
      .output(z.array(Artikel))
      .query(async (req) => {
        const res: Artikel[] = await cmsTool.searchArticle(
          req.input.name,
          req.input.searchString
        );
        return res;
      }),
    getArtikelList: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
        feature: null,
      })
      .input(
        z.object({
          name: artikelContentNameSchema,
          filters: z.optional(z.array(z.string())),
        })
      )
      .output(z.array(Artikel))
      .query(async (req) => {
        const res: Artikel[] = await cmsTool.getContentList(
          req.input.name,
          req.input.filters
        );
        return res;
      }),
    getFileUrl: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
        feature: null,
      })
      .input(z.string())
      .output(z.string())
      .query(async (req) => {
        return config.strapi.host.replace('/api', '') + req.input;
      }),
    getArtikel: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
        feature: null,
      })
      .input(z.object({ documentId: z.string() }))
      .output(Artikel)
      .query(async (req) => {
        const res: Artikel = await cmsTool.getContent(
          'test-artikels',
          req.input.documentId
        );
        return res;
      }),
    getFAQItemList: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
        feature: null,
      })
      .input(
        z.object({
          name: faqItemContentNameSchema,
          filters: z.optional(z.array(z.string())),
        })
      )
      .output(z.array(FAQItem))
      .query(async (req) => {
        const res: FAQItem[] = await cmsTool.getContentList(
          req.input.name,
          req.input.filters
        );
        return res;
      }),
    getContactList: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
        feature: null,
      })
      .input(z.object({ kreis: z.string().optional() }))
      .output(z.array(Contact))
      .query(async (req) => {
        const user: ShUser = await req.ctx.trxFactory(async (trx) => {
          const res = await trx('ShUser').where({
            id: req.ctx.token?.sub,
          });
          return res[0];
        });

        const kreis =
          req.input.kreis == null
            ? await cmsTool.getKreis(user.postalCode)
            : req.input.kreis;

        const res: Contact[] = await cmsTool.getContacts(kreis);
        return res;
      }),

    getWebsiteText: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
        feature: null,
      })
      .input(z.array(z.string()))
      .output(z.array(WebsiteText))
      .query(async (req) => {
        const res: WebsiteText[] = await cmsTool.getWebsiteText(req.input);
        return res;
      }),
    getLoginText: baseProcedure
      .meta({
        requiredRolesAny: ['anon'],
        feature: null,
      })
      .output(LoginPageTexts)
      .query(async (_req) => {
        const res: LoginPageTexts = await cmsTool.getLoginText();
        return res;
      }),
  });
}
