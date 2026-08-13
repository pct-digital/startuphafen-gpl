import { ShUser } from '@startuphafen/startuphafen-common';
import { randomUUID } from 'crypto';
import { importJWK, SignJWT } from 'jose';
import { ServerConfig } from '../../config';
import { OZGTool } from './ozg-tool';

export class BNTKTool {
  private_jwk: {
    crv: string;
    d: string;
    key_ops: string[];
    kty: string;
    x: string;
    y: string;
    alg: string;
    use: string;
    kid: string;
  } | null = null;

  constructor(config: ServerConfig) {
    if (config.bntk !== undefined) {
      this.private_jwk = { ...config.bntk.private_jwk };
    } else {
      console.log(
        'Warn: config.bntk.private_jwk is not set, BNTK will not work'
      );
    }
  }

  async generateJWT(): Promise<string> {
    if (this.private_jwk === null) return '';

    const key = await importJWK(this.private_jwk!, this.private_jwk!.alg);

    return await new SignJWT({
      iss: 'Startuphafen',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 5 * 60,
      aud: 'OvgrExternalApi',
      jti: randomUUID(),
      operation: 'transfer_sds',
    })
      .setProtectedHeader({
        typ: 'JWT',
        alg: 'ES384',
        kid: this.private_jwk.kid,
      })
      .sign(key);
  }

  buildJSON(user: ShUser, uuid: string) {
    const street = OZGTool.parseStreetAddress(user.street);
    const participantId = randomUUID();
    return {
      sdsVersion: '1.0.0',
      exportId: uuid,
      content: {
        areaOfLaw: 'CORPORATE_LAW',
        caseFileId: uuid,
        caseType: {
          code: '2011',
          displayName: 'Gründung einer Gesellschaft',
        },
        participants: [
          {
            participantType: 'NaturalPerson',
            participantId: participantId,
            firstNames: user.firstName,
            surname: user.lastName,
            salutation:
              user.title === 'Herr'
                ? 'MR'
                : user.title === 'Frau'
                ? 'MRS'
                : 'NO_INFORMATION',
            gender:
              user.title === 'Herr'
                ? 'MALE'
                : user.title === 'Frau'
                ? 'FEMALE'
                : 'NO_INFORMATION',
            roles: [
              {
                role: {
                  code: '246',
                  displayName: 'Gesellschafter(in)',
                },
              },
            ],
            addresses: [
              {
                addressType: {
                  code: '017',
                  displayName: 'Privatanschrift',
                },
                city: user.city,
                postalCode: user.postalCode,
                street: street.streetName,
                streetNumber: street.houseNumber,
              },
            ],
            communicationChannels: [
              {
                channelType: 'EMAIL',
                contactPoint: user.email,
              },
              {
                channelType: 'MOBILE',
                contactPoint: user.cellPhoneNumber,
              },
            ].filter((c) => c.contactPoint != null && c.contactPoint !== ''),
          },
        ],
        extensions: [
          {
            entityTitle: 'OVGR',
            customFields: [
              {
                fieldName: 'accountOwnerParticipantId',
                fieldType: 'string',
                value: participantId,
              },
            ],
          },
        ],
      },
    };
  }
}
