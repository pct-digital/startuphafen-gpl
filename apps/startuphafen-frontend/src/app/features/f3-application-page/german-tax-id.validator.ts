import { AbstractControl, FormGroup } from '@angular/forms';
import { FormlyFieldConfig } from '@ngx-formly/core';

// Matches the shareholder taxId keys: the first founder is `St82o`, additional
// founders/shareholders are `St82o_0`, `St82o_1`, ...
const TAX_ID_KEY_PATTERN = /^St82o(_\d+)?$/;

export function isValidGermanTaxId(value: unknown): boolean {
  if (value == null || value === '') return true;

  const taxId = value.toString();
  if (!/^[1-9][0-9]{10}$/.test(taxId)) return false;
  if (!hasValidGermanTaxIdDigitDistribution(taxId)) return false;

  let product = 10;
  for (const char of taxId.slice(0, 10)) {
    const digit = Number(char);
    let sum = (digit + product) % 10;
    if (sum === 0) sum = 10;
    product = (sum * 2) % 11;
  }

  const checkDigit = 11 - product === 10 ? 0 : 11 - product;
  return checkDigit === Number(taxId[10]);
}

export function germanTaxIdValidator(control: AbstractControl): boolean {
  return isValidGermanTaxId(control.value);
}

// Identification documents are persisted on the backend keyed by taxId, so two
// shareholders sharing one would collide into a single document (overwriting on
// upload, aliasing on load). Reject duplicates at the source so the collision
// can never reach the identification-upload step.
export function uniqueTaxIdValidator(
  control: AbstractControl,
  field: FormlyFieldConfig
): boolean {
  const value = control.value;
  if (value == null || value === '') return true; // 'required' handles empty
  const form = field.form;
  if (!(form instanceof FormGroup)) return true;
  let occurrences = 0;
  for (const [key, sibling] of Object.entries(form.controls)) {
    if (TAX_ID_KEY_PATTERN.test(key) && sibling.value === value) {
      occurrences++;
    }
  }
  return occurrences <= 1;
}

// Angular only re-runs a control's own validators when its value changes, so a
// sibling left stale would keep showing a duplicate error after the real
// duplicate is fixed. Call this when any taxId changes to re-validate them all.
export function revalidateTaxIdControls(form: FormGroup): void {
  for (const [key, control] of Object.entries(form.controls)) {
    if (TAX_ID_KEY_PATTERN.test(key)) {
      control.updateValueAndValidity({ emitEvent: false, onlySelf: true });
    }
  }
}

function hasValidGermanTaxIdDigitDistribution(taxId: string): boolean {
  const counts = Array.from({ length: 10 }, () => 0);
  for (const char of taxId.slice(0, 10)) {
    counts[Number(char)]++;
  }

  const missingDigits = counts.filter((count) => count === 0).length;
  const singleDigits = counts.filter((count) => count === 1).length;
  const doubleDigits = counts.filter((count) => count === 2).length;
  const tripleDigits = counts.filter((count) => count === 3).length;

  if (missingDigits === 1 && singleDigits === 8 && doubleDigits === 1) {
    return true;
  }

  if (missingDigits !== 2 || singleDigits !== 7 || tripleDigits !== 1) {
    return false;
  }

  return !/(.)\1\1/.test(taxId.slice(0, 10));
}
