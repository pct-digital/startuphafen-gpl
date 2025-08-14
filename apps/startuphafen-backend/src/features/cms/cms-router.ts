import {
  ArticleCategory,
  Artikel,
  Catalogue,
  CatalogueQuestion,
  Contact,
  FAQItem,
  QuestionFlow,
  SingleTypeData,
  STARTUPHAFEN_ENTITY_SCHEMA,
  WebsiteText,
} from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import { z } from 'zod';
import { LocalSecrets } from '../../config';
import { CMSTool } from './cms-tool';

export function buildCMSRouter(localSecrets: LocalSecrets) {
  const cmsTool = new CMSTool(localSecrets);

  return router({
    helloWorld: baseProcedure.output(z.string()).query(async (_req) => {
      return 'Hello World';
    }),
    getCategories: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
      })
      .input(z.object({ name: z.string() }))
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
      })
      .input(z.object({ name: z.string(), searchString: z.string() }))
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
      })
      .input(
        z.object({ name: z.string(), filters: z.optional(z.array(z.string())) })
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
      .meta({ requiredRolesAny: ['login'] })
      .input(z.string())
      .output(z.string())
      .query(async (req) => {
        return localSecrets.strapi.host.replace('/api', '') + req.input;
      }),
    getArtikel: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
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
      })
      .input(
        z.object({ name: z.string(), filters: z.optional(z.array(z.string())) })
      )
      .output(z.array(FAQItem))
      .query(async (req) => {
        const res: FAQItem[] = await cmsTool.getContentList(
          req.input.name,
          req.input.filters
        );
        return res;
      }),
    getFAQItem: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
      })
      .input(z.object({ documentId: z.string() }))
      .output(FAQItem)
      .query(async (req) => {
        const res: FAQItem = await cmsTool.getContent(
          'faq-items',
          req.input.documentId
        );
        return res;
      }),
    getContactList: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
      })
      .input(
        z.object({ name: z.string(), filters: z.optional(z.array(z.string())) })
      )
      .output(z.array(Contact))
      .query(async (req) => {
        const res: Contact[] = await cmsTool.getContentList(
          req.input.name,
          req.input.filters
        );
        return res;
      }),
    getQuestionFlowByFlowId: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
      })
      .input(z.string())
      .output(QuestionFlow)
      .query(async (req) => {
        const res: QuestionFlow = await cmsTool.getQuestionFlowByFlowId(
          req.input
        );
        return res;
      }),
    getQuestionFlow: baseProcedure
      .meta({
        requiredRolesAny: ['login'],
      })
      .input(z.string())
      .output(QuestionFlow)
      .query(async (req) => {
        const res: QuestionFlow = await cmsTool.getQuestionFlow(req.input);
        return res;
      }),
    getSingleTypeData: baseProcedure
      .meta({ requiredRolesAny: ['anon'] })
      .input(z.string())
      .output(SingleTypeData)
      .query(async (req) => {
        const getSingleTypeData: SingleTypeData =
          await cmsTool.getSingleTypeData(req.input);
        return getSingleTypeData;
      }),
    getWebsiteText: baseProcedure
      .meta({ requiredRolesAny: ['anon'] })
      .input(z.array(z.string()))
      .output(z.array(WebsiteText))
      .query(async (req) => {
        const res: WebsiteText[] = await cmsTool.getWebsiteText(req.input);
        return res;
      }),
    getQuestionCatalogue: baseProcedure
      .meta({ requiredRolesAny: ['login'] })
      .input(z.number())
      .output(
        z.object({
          id: z.number(),
          documentId: z.string(),
          catalogueId: z.string(),
          createdAt: z.string(),
          updatedAt: z.string(),
          publishedAt: z.string(),
          questions: z.array(CatalogueQuestion),
        })
      )
      .query(async (req) => {
        const project = await req.ctx.trxFactory((trx) => {
          const res = trx(
            STARTUPHAFEN_ENTITY_SCHEMA.ShProject.table.name
          ).where({ id: req.input });
          return res;
        });
        if (project.length === 0) throw new Error('Project not found');

        const catalogue = await req.ctx.trxFactory((trx) => {
          const res = trx(
            STARTUPHAFEN_ENTITY_SCHEMA.ShCatalogueVersions.table.name
          ).where({ id: project[0].versionId });
          return res;
        });
        if (catalogue.length === 0)
          throw new Error('Catalogue entry not found');
        return JSON.parse(catalogue[0].catalogueJSON);
      }),
    questionVersionLoader: baseProcedure
      .meta({ requiredRolesAny: ['login'] })
      .input(z.string())
      .output(z.number())
      .query(async (req) => {
        const res = await cmsTool.getQuestionatalogue(req.input);
        const dbRes = await req.ctx.trxFactory(async (trx) => {
          const res = await trx('ShCatalogueVersions').where({
            catalogueId: req.input,
          });
          return res;
        });

        if (dbRes.length === 0) {
          return await req.ctx.trxFactory(async (trx) => {
            const createEnt = {
              catalogueId: req.input,
              catalogueJSON: JSON.stringify(res),
              createdAt: new Date(),
            };
            const result = await trx(
              STARTUPHAFEN_ENTITY_SCHEMA.ShCatalogueVersions.table.name
            )
              .insert(createEnt)
              .returning('id');
            return result[0].id;
          });
        }

        const newestDBRes = dbRes.reduce((prev, current) => {
          return prev && prev.id > current.id ? prev : current;
        });

        if (!checkUdpatedAtProperties(newestDBRes, res)) {
          return await req.ctx.trxFactory(async (trx) => {
            const createEnt = {
              catalogueId: req.input,
              catalogueJSON: JSON.stringify(res),
              createdAt: new Date(),
            };
            const result = await trx(
              STARTUPHAFEN_ENTITY_SCHEMA.ShCatalogueVersions.table.name
            )
              .insert(createEnt)
              .returning('id');
            return result[0].id;
          });
        }
        return newestDBRes.id;
      }),
    compareToNewest: baseProcedure
      .meta({ requiredRolesAny: ['login'] })
      .input(Catalogue)
      .output(z.boolean())
      .mutation(async (req) => {
        const res = await cmsTool.getQuestionatalogue(req.input.catalogueId);
        return checkUdpatedAtProperties(req.input, res);
      }),
  });
}

function checkUdpatedAtProperties(c1: Catalogue, c2: Catalogue) {
  if (c1 == null) return false;
  if (c1.updatedAt !== c2.updatedAt) return false;

  for (let index = 0; index < c1.questions.length; index++) {
    if (c1.questions[index].updatedAt !== c2.questions[index].updatedAt)
      return false;
  }

  return true;
}
