import { TransactionFactory } from '@startuphafen/serialized-transaction';
import {
  Project,
  STARTUPHAFENBACKEND_TABLES,
} from '@startuphafen/startuphafen-common';
import { IdentificationDocumentsDbController } from '../identification-documents/identification-documents-db-controller';

export const PROJECT_RETENTION_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export class ProjectCleanupService {
  constructor(private trxFactory: TransactionFactory) {}

  async deleteExpiredProjects(
    retentionDays = PROJECT_RETENTION_DAYS
  ): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * DAY_MS);

    const { deletedProjects, deletedOrphanedIdDocuments } =
      await this.trxFactory(async (trx) => {
        const deletedProjects = await trx<Project>(
          STARTUPHAFENBACKEND_TABLES.PROJECT
        )
          .where('createdAt', '<', cutoff)
          .delete();

        const idDocuments = new IdentificationDocumentsDbController(trx);
        const deletedOrphanedIdDocuments =
          await idDocuments.deleteDocumentsWithoutProject();

        return { deletedProjects, deletedOrphanedIdDocuments };
      });

    if (deletedProjects > 0 || deletedOrphanedIdDocuments > 0) {
      console.info('Project cleanup deleted expired data', {
        deletedProjects,
        deletedOrphanedIdDocuments,
        cutoff,
        retentionDays,
      });
    }

    return deletedProjects;
  }
}
