import {
  FormDataBuilder,
  FormDataInput,
  isAllowed,
  OZGResponse,
  ShAnswers,
  ShUser,
  stringToBoolean,
} from '@startuphafen/startuphafen-common';
import { baseProcedure, router } from '@startuphafen/trpc-root';
import _ from 'lodash';
import { z } from 'zod';
import { LocalSecrets } from '../../config';
import { OZGTool } from './ozg-tool';

function getValueFromDBAnswers(answers: ShAnswers[], key: string) {
  const answer = answers.find((e) => e.key === key);
  if (answer == null) return null;
  return answer.value;
}

export function buildOZGRouter(localConfig: LocalSecrets) {
  const ozgTool = new OZGTool(localConfig);

  return router({
    postOZGFormData: baseProcedure
      .meta({
        requiredRolesAny: ['bundID-high'],
      })
      .input(z.number())
      .output(z.union([OZGResponse, z.null()]))
      .mutation(async (req) => {
        const allowed = await req.ctx.trxFactory(async (trx) => {
          return isAllowed(trx, req.input, req.ctx.token?.sub);
        });

        if (!allowed) return null;

        const user: ShUser = await req.ctx.trxFactory(async (trx) => {
          const res = await trx('ShUser').where({
            id: req.ctx.token?.sub,
          });
          return res[0];
        });

        const tracking: string[] = await req.ctx.trxFactory(async (trx) => {
          const res = await trx('ShQuestionTracking').where({
            projectId: req.input,
          });
          const arr = res.map((e) => e.strapiQuestionId);
          return arr;
        });
        const dbAnswers: ShAnswers[] = await req.ctx.trxFactory(async (trx) => {
          const res = await trx('ShAnswers').where({ projectId: req.input });
          return res;
        });

        const filtered = dbAnswers.filter((e) => tracking.includes(e.key));

        const street = parseStreetAddress(user.street);

        const addressData = filtered.filter((e) =>
          e.key.includes('SteEr69-71b')
        );

        //Antragstellende Person und Betriebsstätte momentan noch hardcoded ... TODO
        const formDataInput: FormDataInput = {
          'Antragstellende Person': {
            Adresse: {
              Hausnummer: street.houseNumber,
              Ort: user.city.toString(),
              PLZ: user.postalCode.toString(),
              Straße: street.streetName,
            },
            Geburtsdatum: user.dateOfBirth.toString(),
            Anrede:
              user.title === 'Herr'
                ? 'männlich'
                : user.title === 'Frau'
                ? 'weiblich'
                : 'Keine Angabe',
            Titel: user.academicTitle ?? 'Keine Angabe',
            Vorname: user.firstName,
            Nachname: user.lastName,
            Telefonnummer:
              user.cellPhoneNumber !== ''
                ? user.cellPhoneNumber
                : user.phoneNumber,
            EMail: user.email.toString(),
            Staatsangehörigkeit: user.country,
          },
          Betriebsdaten: {
            'Angemeldete Tätigkeit': {
              Beginn: getValueFromDBAnswers(filtered, 'SteEr96') ?? '',
              Nebenerwerb: stringToBoolean(
                getValueFromDBAnswers(filtered, 'GewA19')
              ),
              Beschreibung: getValueFromDBAnswers(filtered, 'SteEr25') ?? '',
            },
            'Vorliegende Erlaubnis': {
              'Erlaubnis liegt vor': stringToBoolean(
                getValueFromDBAnswers(filtered, 'GewA28')
              ),
              'Ausstellende Behörde':
                filtered.find((a) => a.key.includes('GewA28a'))?.value ?? '',
              Ausstellungsdatum:
                filtered.find((a) => a.key.includes('GewA28b'))?.value ?? '',
            },
            'Vorliegende Handwerkskarte': {
              'Handwerkskarte liegt vor': stringToBoolean(
                getValueFromDBAnswers(filtered, 'GewA29')
              ),
              'Name der Handwerkskammer':
                filtered.find((a) => a.key.includes('GewA29a'))?.value ?? '',
              Ausstellungsdatum:
                filtered.find((a) => a.key.includes('GewA29b'))?.value ?? '',
            },
          },
        };

        if (addressData.length !== 0) {
          _.merge(formDataInput.Betriebsdaten, {
            Betriebsstätte: {
              Hausnummer: addressData.find((a) =>
                a.strapiAnswerId.includes('stAnt70a')
              )?.value,
              Ort: addressData.find((a) =>
                a.strapiAnswerId.includes('stAnt71b')
              )?.value,
              PLZ: addressData.find((a) =>
                a.strapiAnswerId.includes('stAnt71a')
              )?.value,
              Straße: addressData.find((a) =>
                a.strapiAnswerId.includes('stAnt69')
              )?.value,
            },
          });
        } else if (
          filtered.find((a) => a.key === 'SteEr68')?.value ===
          'Entspricht meiner privaten Adresse'
        ) {
          _.merge(formDataInput.Betriebsdaten, {
            Betriebsstätte: {
              Hausnummer: street.houseNumber,
              Ort: user.city.toString(),
              PLZ: user.postalCode.toString(),
              Straße: street.streetName,
            },
          });
        }

        if (formDataInput == null) return null;

        const formDataBuilder = new FormDataBuilder();
        const formDataBuild = formDataBuilder.build(formDataInput);

        const res: OZGResponse = await ozgTool.postOZGFormData(formDataBuild);
        return res;
      }),
  });
}

/**
 * Parses a street address string into street name and house number
 * @param street Full street address
 * @returns Object containing streetName and houseNumber
 */
function parseStreetAddress(street: string): {
  streetName: string;
  houseNumber: string;
} {
  // Match house number patterns including ranges (e.g., 21-30, 2a-2f)
  // This regex matches:
  // - Simple house numbers like "15" or "3a"
  // - Ranges like "21-30" or "2a-2f"
  const match = street.match(/\s+(\d+\w*(?:-\d+\w*)?)\s*$/);

  if (match) {
    const houseNumber = match[1];
    // Remove the house number part from the street string and trim
    const streetName = street.substring(0, street.lastIndexOf(match[0])).trim();
    return { streetName, houseNumber };
  }

  // Fallback if no house number is found
  return { streetName: street, houseNumber: '' };
}
