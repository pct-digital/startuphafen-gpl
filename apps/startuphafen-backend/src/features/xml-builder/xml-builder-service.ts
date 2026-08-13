import { Answers } from '@startuphafen/startuphafen-common';
import _ from 'lodash';

export function normalizeEszett(value: string): string {
  return value.replace(/ẞ/g, 'ß');
}

export function toGermanDate(value: string): string {
  if (value == null) return value;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso != null) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact != null) return `${compact[3]}.${compact[2]}.${compact[1]}`;
  return value;
}
export class XMLBuilderService {
  findApplicableRuleSet: (
    obj: any,
    ruleSets: Record<string, string[]>
  ) => string[];
  sanitizeValue: (value: string, key: string) => string;

  constructor(
    findApplicableRuleSet: (
      obj: any,
      ruleSets: Record<string, string[]>
    ) => string[],
    sanitizeValue?: (value: string, key: string) => string
  ) {
    this.findApplicableRuleSet = findApplicableRuleSet;
    this.sanitizeValue = sanitizeValue ?? ((value) => value);
  }

  parseStreetAddress(street: string): {
    streetName: string;
    houseNumber: string;
    houseNumberSuffix: string;
  } {
    // Match house number patterns including ranges (e.g., 21-30, 2a-2f)
    const match = street.match(/\s+(\d+\w*(?:-\d+\w*)?)\s*$/);

    if (match) {
      const rawHouseNumber = match[1];
      // Remove the house number part from the street string and trim
      const streetName = street
        .substring(0, street.lastIndexOf(match[0]))
        .trim();

      // Split numeric part from trailing alphabetic suffix (e.g. "21a" -> "21" + "a")
      // Ranges like "21-30" stay fully in houseNumber
      const splitMatch = rawHouseNumber.match(/^(\d+)([a-zA-Z]+)$/);
      if (splitMatch) {
        return {
          streetName,
          houseNumber: splitMatch[1],
          houseNumberSuffix: splitMatch[2],
        };
      }

      return {
        streetName,
        houseNumber: rawHouseNumber,
        houseNumberSuffix: '',
      };
    }

    // Fallback if no house number is found
    return {
      streetName: street,
      houseNumber: '',
      houseNumberSuffix: '',
    };
  }

  filterXmlKeys(con: Answers) {
    if (con.key.includes('St') && con.key !== '') {
      const pathObj = con.xmlKey.split('/');
      return pathObj;
    }
    return;
  }

  sortObjectRecursively(obj: any, ruleSet: Record<string, string[]>): any {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return obj;
    }

    const currentRuleSet = this.findApplicableRuleSet(obj, ruleSet);

    const sortedEntries = Object.entries(obj).sort(([keyA], [keyB]) => {
      const indexA = currentRuleSet.indexOf(keyA);
      const indexB = currentRuleSet.indexOf(keyB);

      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }

      if (indexA !== -1) {
        return -1;
      }

      if (indexB !== -1) {
        return 1;
      }

      return 0;
    });

    return Object.fromEntries(
      sortedEntries.map(([key, value]) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          return [key, this.sortObjectRecursively(value, ruleSet)];
        }
        return [key, value];
      })
    );
  }

  fillStructure(content: Answers[], ignoreList?: string[]) {
    const obj = {};
    for (const con of content) {
      const list = this.filterXmlKeys(con)?.reverse() ?? [];
      const optionalIgnore = ignoreList == null ? [] : ignoreList;
      if (
        list.length !== 0 &&
        list[0] !== '' &&
        list[0] !== '?' &&
        !optionalIgnore.includes(con.componentId)
      ) {
        _.merge(
          obj,
          this.createDataStructure(
            list,
            con.stringValue == null ? con.value : con.stringValue
          )
        );
      }
    }
    return obj;
  }

  private createDataStructure(list: string[], val: string) {
    let obj: { [k: string]: string | object } = {};
    for (const xmlKeyIndex in list) {
      if (val !== '') {
        if (Number(xmlKeyIndex) === 0) {
          obj[list[xmlKeyIndex]] = this.sanitizeValue(val, list[xmlKeyIndex]);
        } else {
          obj = { [list[xmlKeyIndex]]: obj };
        }
      }
    }

    return obj;
  }
}
