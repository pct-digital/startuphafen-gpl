import { Answers } from '@startuphafen/startuphafen-common';

export const LOCKED_HWK_ELIGIBILITY_KEYS = [
  'Us1',
  'HwkBranche',
  'Gw29',
  'HwkEntryType',
] as const;

export function hasCompletedQuestionnaire(
  answers: Answers[],
  answeredQuestions: string[] | null | undefined
) {
  const trackedKeys = new Set(
    (answeredQuestions ?? []).map((key) => key.trim()).filter(Boolean)
  );

  if (trackedKeys.size === 0) {
    return false;
  }

  const answerKeys = new Set(
    answers.map((answer) => answer.key.trim()).filter(Boolean)
  );

  for (const key of trackedKeys) {
    if (!answerKeys.has(key)) {
      return false;
    }
  }

  return true;
}

export function touchesLockedHwkEligibilityKey(keys: Iterable<string>) {
  const lockedKeys = new Set<string>(LOCKED_HWK_ELIGIBILITY_KEYS);
  for (const key of keys) {
    if (lockedKeys.has(key)) {
      return true;
    }
  }

  return false;
}
