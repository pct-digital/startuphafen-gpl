import { Knex } from 'knex';
import {
  Project,
  STARTUPHAFEN_ENTITY_SCHEMA,
} from '../../generated/db-entities';

export const stringToBoolean = (value: string | null | undefined): boolean => {
  if (!value) return false;

  const normalizedValue = value.toLowerCase().trim();
  return (
    normalizedValue === 'true' ||
    normalizedValue === '1' ||
    normalizedValue === 'yes' ||
    normalizedValue === 'y' ||
    normalizedValue === 'ja'
  );
};

export const isAllowed = async (
  trx: Knex.Transaction,
  projectId: number | undefined,
  userId: string | undefined
) => {
  if (userId == null || projectId == null) return false;

  const queryRes: Project[] = await trx(
    STARTUPHAFEN_ENTITY_SCHEMA.ShProject.table.name
  ).where({
    id: projectId,
    userId: userId,
  });

  return queryRes.length > 0;
};
