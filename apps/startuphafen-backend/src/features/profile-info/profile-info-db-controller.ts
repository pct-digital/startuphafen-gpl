import {
  ProfileInfo,
  STARTUPHAFENBACKEND_TABLES,
} from '@startuphafen/startuphafen-common';
import { Knex } from 'knex';

export type ProfileInfoInput = Omit<ProfileInfo, 'id' | 'createdAt'>;
export type ProfileInfoResult = Partial<ProfileInfo>;

export class ProfileInfoDbController {
  constructor(private trx: Knex.Transaction) {}

  async upsert(input: ProfileInfoInput) {
    const existing = await this.trx<ProfileInfo>(
      STARTUPHAFENBACKEND_TABLES.PROFILEINFO
    )
      .where({ userId: input.userId })
      .first();

    if (existing) {
      await this.trx<ProfileInfo>(STARTUPHAFENBACKEND_TABLES.PROFILEINFO)
        .where({ userId: input.userId })
        .update({
          phoneInternational: input.phoneInternational,
          phoneNational: input.phoneNational,
          phoneNumber: input.phoneNumber,
          website: input.website,
          birthCountry: input.birthCountry,
          birthPlace: input.birthPlace,
        });
    } else {
      await this.trx<ProfileInfo>(
        STARTUPHAFENBACKEND_TABLES.PROFILEINFO
      ).insert({
        userId: input.userId,
        phoneInternational: input.phoneInternational,
        phoneNational: input.phoneNational,
        phoneNumber: input.phoneNumber,
        website: input.website,
        birthCountry: input.birthCountry,
        birthPlace: input.birthPlace,
      });
    }
  }

  async getByUserId(userId: string) {
    const profileInfo = await this.trx<ProfileInfo>(
      STARTUPHAFENBACKEND_TABLES.PROFILEINFO
    )
      .where({ userId })
      .first();

    const result: ProfileInfoResult = {
      phoneInternational: profileInfo?.phoneInternational ?? '',
      phoneNational: profileInfo?.phoneNational ?? '',
      phoneNumber: profileInfo?.phoneNumber ?? '',
      website: profileInfo?.website ?? null,
      birthCountry: profileInfo?.birthCountry ?? '',
      birthPlace: profileInfo?.birthPlace ?? '',
    };

    return result;
  }
}
