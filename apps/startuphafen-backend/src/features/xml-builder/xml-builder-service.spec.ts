import { Answers } from '@startuphafen/startuphafen-common';
import { XMLBuilderService } from './xml-builder-service';

describe('XMLBuilderService', () => {
  const makeAnswer = (overrides: Partial<Answers>): Answers => ({
    answerText: '',
    componentId: 'St1',
    headerText: null,
    id: 1,
    key: 'St1',
    projectId: 1,
    questionText: '',
    stringValue: null,
    type: 'text',
    value: 'foo',
    xmlKey: 'KapG/Gesellschafter/Feld',
    ...overrides,
  });

  it('parses numeric house numbers', () => {
    const svc = new XMLBuilderService(() => []);
    const result = svc.parseStreetAddress('Musterstraße 12');
    expect(result).toEqual({
      streetName: 'Musterstraße',
      houseNumber: '12',
      houseNumberSuffix: '',
    });
  });

  it('parses alphanumeric house numbers', () => {
    const svc = new XMLBuilderService(() => []);
    const result = svc.parseStreetAddress('Testweg 10b');
    expect(result).toEqual({
      streetName: 'Testweg',
      houseNumber: '10',
      houseNumberSuffix: 'b',
    });
  });

  it('fills nested structure with sanitized values', () => {
    const svc = new XMLBuilderService(
      () => [],
      () => 'clean'
    );
    const answers = [
      makeAnswer({
        componentId: 'St2',
        key: 'St2',
        stringValue: null,
        value: 'dirty',
        xmlKey: 'KapG/AllgAngaben/Firmenname',
      }),
    ];

    const filled = svc.fillStructure(answers);
    expect(filled).toEqual({
      KapG: {
        AllgAngaben: {
          Firmenname: 'clean',
        },
      },
    });
  });

  it('sorts objects according to rule sets', () => {
    const svc = new XMLBuilderService(
      (obj: any, ruleSets: Record<string, string[]>) => {
        if ('FragebogenTyp' in obj) return ruleSets.root;
        if ('Firmenname' in obj) return ruleSets.allg;
        return [];
      }
    );

    const sorted = svc.sortObjectRecursively(
      {
        KapG: {
          AllgAngaben: {
            Firmenname: 'A',
            Rechtsform: 'GmbH',
          },
          FragebogenTyp: 'foo',
          Ordnungskriterium: { OrdNrArt: 'O' },
        },
      },
      {
        root: ['FragebogenTyp', 'Ordnungskriterium', 'AllgAngaben'],
        allg: ['Firmenname', 'Rechtsform'],
      }
    );

    expect(Object.keys(sorted.KapG)).toEqual([
      'FragebogenTyp',
      'Ordnungskriterium',
      'AllgAngaben',
    ]);
    expect(Object.keys(sorted.KapG.AllgAngaben)).toEqual([
      'Firmenname',
      'Rechtsform',
    ]);
  });
});
