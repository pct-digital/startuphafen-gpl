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
    STARTUPHAFEN_ENTITY_SCHEMA.Project.table.name
  ).where({
    id: projectId,
    userId: userId,
  });

  return queryRes.length > 0;
};

export function formatDateToGerman(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${day}-${month}-${year}-${hours}:${minutes}`;
}

export function formatGermanDate(input: string | null): string {
  if (!input) return '';
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!isoMatch) return input.trim();
  const [, year, month, day] = isoMatch;
  return `${day}.${month}.${year}`;
}

// Placeholder shown in fields that cannot hold a value (e.g. a company's
// nationality or birth date).
export const NOT_APPLICABLE = '-';

export interface AddressLike {
  street: string | null;
  houseNumber: string | null;
  addressExtra?: string | null;
  postalCode: string | null;
  city: string | null;
}

/**
 * Joins the given parts with the separator, dropping any that are null,
 * undefined or blank after trimming.
 */
export function joinNonEmpty(
  parts: Array<string | null | undefined>,
  separator: string
): string {
  return parts
    .map((part) => part?.trim() ?? '')
    .filter((part) => part.length > 0)
    .join(separator);
}

export function buildFullName(
  firstName: string | null | undefined,
  lastName: string | null | undefined
): string {
  return joinNonEmpty([firstName, lastName], ' ');
}

/** "Straße Hausnummer Zusatz" with blank segments dropped. */
export function formatStreetLine(address: AddressLike): string {
  return joinNonEmpty(
    [address.street, address.houseNumber, address.addressExtra],
    ' '
  );
}

/** "PLZ Ort" with blank segments dropped. */
export function formatPostalLine(address: AddressLike): string {
  return joinNonEmpty([address.postalCode, address.city], ' ');
}

/** "Straße Hausnummer Zusatz, PLZ Ort" with blank segments dropped. */
export function formatAddressLine(address: AddressLike): string {
  return joinNonEmpty(
    [formatStreetLine(address), formatPostalLine(address)],
    ', '
  );
}
