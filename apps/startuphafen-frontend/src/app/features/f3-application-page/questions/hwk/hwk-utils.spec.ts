import { isHwkFlowAllowed, QuestionAnswerValues } from './hwk-utils';

describe('isHwkFlowAllowed', () => {
  it('returns true for eun handwerk when no existing hwk entry is present', () => {
    const answers: QuestionAnswerValues = {
      __catalogueId: 'eun',
      Us1: 'us1Ans-2',
    };

    expect(isHwkFlowAllowed(answers)).toBe(true);
  });

  it('returns false for eun when an existing hwk entry is already present', () => {
    const answers: QuestionAnswerValues = {
      __catalogueId: 'eun',
      Us1: 'us1Ans-2',
      Gw29: 'gw29Ans-1',
    };

    expect(isHwkFlowAllowed(answers)).toBe(false);
  });

  it('returns false for kapg when an existing hwk entry is already present', () => {
    const answers: QuestionAnswerValues = {
      __catalogueId: 'kapg',
      HwkBranche: 'us1Ans-2',
      Gw29: 'gw29Ans-1',
    };

    expect(isHwkFlowAllowed(answers)).toBe(false);
  });
});
