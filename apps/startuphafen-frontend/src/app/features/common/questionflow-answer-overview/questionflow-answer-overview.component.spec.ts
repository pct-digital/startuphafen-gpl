import { createComponentFactory, Spectator } from '@ngneat/spectator/jest';
import { AnswerObject } from '@startuphafen/startuphafen-common';
import { QuestionflowAnswerOverviewComponent } from './questionflow-answer-overview.component';

describe('QuestionFlowAnswerOverviewComponent', () => {
  let spectator: Spectator<QuestionflowAnswerOverviewComponent>;
  const createComponent = createComponentFactory(
    QuestionflowAnswerOverviewComponent
  );

  global.structuredClone = (val) => JSON.parse(JSON.stringify(val));

  it('should correctly format answers', () => {
    const mockAnswers: AnswerObject = {
      one: {
        type: 'none',
        headerText: null,
        answerText: 'Answer 3',
        componentId: 'a3',
        questionText: 'Question 3',
        stringValue: null,
        value: null,
        xmlKey: '/',
      },
      two: {
        type: 'none',
        headerText: 'Header 1',
        answerText: 'Answer 1',
        componentId: 'a1',
        questionText: 'Question 1',
        stringValue: null,
        value: null,
        xmlKey: '/',
      },
      three: {
        type: 'none',
        headerText: 'Header 1',
        answerText: 'Answer 2',
        componentId: 'a2',
        questionText: 'Question 2',
        stringValue: null,
        value: null,
        xmlKey: '/',
      },
    };
    const mockSteps: Array<{
      key: string;
      label: string;
    }> = [];
    for (let i = 1; i <= 3; i++) {
      mockSteps.push({
        key: `a${i}`,
        label: `Question ${i}`,
      });
    }

    spectator = createComponent({
      props: {
        answers: mockAnswers,
        steps: mockSteps as any,
      },
    });

    const formattedAnswers = spectator.component.formatAnswers();
    expect(formattedAnswers).toEqual([
      {
        type: 'none',
        headerText: 'Header 1',
        answerText: 'Answer 1',
        componentId: 'a1',
        questionText: 'Question 1',
        stringValue: null,
        value: null,
        xmlKey: '/',
        hasHeader: true,
        makeSpace: false,
      },
      {
        type: 'none',
        headerText: null,
        answerText: 'Answer 2',
        componentId: 'a2',
        questionText: 'Question 2',
        stringValue: null,
        value: null,
        xmlKey: '/',
        hasHeader: true,
        makeSpace: true,
      },
      {
        type: 'none',
        headerText: null,
        answerText: 'Answer 3',
        componentId: 'a3',
        questionText: 'Question 3',
        stringValue: null,
        value: null,
        xmlKey: '/',
        hasHeader: false,
        makeSpace: false,
      },
    ]);
  });
});
