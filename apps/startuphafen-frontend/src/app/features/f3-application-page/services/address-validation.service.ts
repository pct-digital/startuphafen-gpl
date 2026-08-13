import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AddressValidationService {
  localitiesCache: Map<string, { name: string }[]> = new Map();
  streetsCache: Map<string, any[]> = new Map();

  private OPENPLZ_URL = 'https://openplzapi.org/de';

  async getLocalities(postalCode: string): Promise<{ name: string }[]> {
    if (this.localitiesCache.has(postalCode)) {
      return this.localitiesCache.get(postalCode)!;
    }
    const localities = [];
    let page = 1;
    while (true) {
      const response = await fetch(
        `${this.OPENPLZ_URL}/Localities?postalCode=${encodeURIComponent(
          postalCode
        )}&page=${page}`,
        {
          method: 'GET',
          headers: {
            accept: 'text/json',
          },
        }
      );
      const pageLocalities = await response.json();
      localities.push(...pageLocalities);
      if (pageLocalities.length === 0) {
        break;
      }
      page += 1;
    }
    this.localitiesCache.set(postalCode, localities);
    return localities;
  }

  async getStreets(
    street: string,
    postalCode: string,
    locality: string
  ): Promise<any[]> {
    const cacheKey = `${street}|${postalCode}|${locality}`;
    if (this.streetsCache.has(cacheKey)) {
      return this.streetsCache.get(cacheKey)!;
    }
    const response = await fetch(
      `${this.OPENPLZ_URL}/Streets?name=^${encodeURIComponent(
        street
      )}$&postalCode=${encodeURIComponent(
        postalCode
      )}&locality=${encodeURIComponent(locality)}`,
      {
        method: 'GET',
        headers: {
          accept: 'text/json',
        },
      }
    );
    const streets = await response.json();
    this.streetsCache.set(cacheKey, streets);
    return streets;
  }

  async postalCodeMatchesLocality(postalCode: string, locality: string) {
    const localities = await this.getLocalities(postalCode);
    return localities.some((x) => x.name === locality);
  }

  async streetExistsInPostalCode(
    postalCode: string,
    street: string,
    locality: string
  ) {
    let adjustedStreet = street;
    let adjusted = false;
    // openplz seems to default to "str." as street ending
    if (street.endsWith('str')) {
      adjustedStreet = `${street.slice(0, -3)}str.`;
      adjusted = true;
    } else if (street.endsWith('straße')) {
      adjustedStreet = `${street.slice(0, -6)}str.`;
      adjusted = true;
    } else if (street.endsWith('Str')) {
      adjustedStreet = `${street.slice(0, -3)}Str.`;
      adjusted = true;
    } else if (street.endsWith('Straße')) {
      adjustedStreet = `${street.slice(0, -6)}Str.`;
      adjusted = true;
    }

    const streets = await this.getStreets(adjustedStreet, postalCode, locality);
    if (streets.length === 0 && adjusted) {
      // in case name adjustment was wrong, try again with original name
      const normalStreets = await this.getStreets(street, postalCode, locality);
      return normalStreets.length > 0;
    }
    return streets.length > 0;
  }
}
