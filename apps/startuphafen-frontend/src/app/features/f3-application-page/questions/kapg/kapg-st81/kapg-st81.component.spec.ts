import { Spectator, createComponentFactory } from '@ngneat/spectator/jest';

import { FormGroup } from '@angular/forms';
import { FormlyFieldConfig, FormlyModule } from '@ngx-formly/core';
import {
  FormlyFieldDateComponent,
  FormlyFieldEmptyComponent,
  FormlyFieldInputComponent,
  FormlyFieldNumberComponent,
  FormlyFieldNumberEuroComponent,
  FormlyFieldPercentComponent,
  FormlyFieldRadioComponent,
  FormlyWrapperHeading,
  TrpcService,
} from '@startuphafen/angular-common';
import { AnswerObject } from '@startuphafen/startuphafen-common';
import { ApplicationPageService } from '../../../application-page.service';
import { KapgSt81Component } from './kapg-st81.component';

// filterHiddenFields, getHiddenFieldKeys and findSelectedField only use `this`
// to call each other, so binding the real implementations onto a single mock
// object lets us reuse them directly to exercise the cleanup logic.
const mockApService = {
  buildAnswerObject: jest.fn(),
  filterHiddenFields: ApplicationPageService.prototype.filterHiddenFields,
  getHiddenFieldKeys: ApplicationPageService.prototype.getHiddenFieldKeys,
  findSelectedField: ApplicationPageService.prototype.findSelectedField,
};

// The first shareholder's fields are wrapped in a `fieldGroup`, so flatten the
// tree before looking up individual fields by key.
function flattenFields(fields: FormlyFieldConfig[]): FormlyFieldConfig[] {
  return fields.flatMap((field) =>
    field.fieldGroup
      ? [field, ...flattenFields(field.fieldGroup)]
      : [field]
  );
}

// Builds a minimal AnswerObject whose keys mark which answers are "persisted".
function persistedAnswers(keys: string[]): AnswerObject {
  return Object.fromEntries(
    keys.map((key) => [
      key,
      {
        value: 'x',
        type: 'string',
        xmlKey: '/',
        componentId: 'St81',
        stringValue: null,
        questionText: '',
        answerText: '',
        headerText: null,
      },
    ])
  );
}
describe('KapgSt81Component', () => {
  let spectator: Spectator<KapgSt81Component>;
  const createComponent = createComponentFactory({
    component: KapgSt81Component,
    imports: [
      FormlyModule.forRoot({
        types: [
          {
            name: 'string',
            component: FormlyFieldInputComponent,
          },
          {
            name: 'empty',
            component: FormlyFieldEmptyComponent,
          },
          {
            name: 'multi-single',
            component: FormlyFieldRadioComponent,
          },
          {
            name: 'number',
            component: FormlyFieldNumberComponent,
          },
          {
            name: 'date',
            component: FormlyFieldDateComponent,
          },
          {
            name: 'number-euro',
            component: FormlyFieldNumberEuroComponent,
          },
          {
            name: 'percent',
            component: FormlyFieldPercentComponent,
          },
        ],
        wrappers: [
          {
            name: 'heading',
            component: FormlyWrapperHeading,
          },
        ],
      }),
    ],
    providers: [{ provide: ApplicationPageService, useValue: mockApService }],
    mocks: [TrpcService],
  });

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  it('should create', () => {
    spectator = createComponent();

    expect(spectator.component).toBeTruthy();
  });

  it('should use final 202401 xml keys for natural person shareholder ids', () => {
    spectator = createComponent();
    spectator.component.ngOnInit();

    const persIdField = flattenFields(spectator.component.fields).find(
      (field) => field.key === 'St82o_0'
    );

    expect(persIdField?.props?.['xmlKey']).toBe(
      'Gesellschafter/Anteilseigner/NatPers/PersIdNr'
    );
  });

  it('should validate natural person shareholder tax IDs beyond the 11 digit pattern', () => {
    spectator = createComponent();
    spectator.component.ngOnInit();

    const persIdField = flattenFields(spectator.component.fields).find(
      (field) => field.key === 'St82o_0'
    );
    const validator = persIdField?.validators?.['germanTaxId']?.expression as (
      control: { value: string }
    ) => boolean;

    expect(validator({ value: '10020345677' })).toBe(true);
    expect(validator({ value: '10020345676' })).toBe(false);
  });

  describe('Percentage Validation', () => {
    beforeEach(() => {
      spectator = createComponent();
      spectator.component.ngOnInit();
    });

    it('should calculate totalPercentage correctly with no shareholders', () => {
      spectator.component.questionCount = 0;

      expect(spectator.component.totalPercentage).toBe(0);
    });

    it('should calculate totalPercentage correctly with one shareholder', () => {
      spectator.component.questionCount = 1;
      spectator.component.model['St84b_0'] = 50;

      expect(spectator.component.totalPercentage).toBe(50);
    });

    it('should calculate totalPercentage correctly with multiple shareholders', () => {
      spectator.component.questionCount = 3;
      spectator.component.model['St84b_0'] = 40;
      spectator.component.model['St84b_1'] = 35;
      spectator.component.model['St84b_2'] = 25;

      expect(spectator.component.totalPercentage).toBe(100);
    });

    it('should round totalPercentage to 2 decimal places', () => {
      spectator.component.questionCount = 3;
      spectator.component.model['St84b_0'] = 33.33;
      spectator.component.model['St84b_1'] = 33.33;
      spectator.component.model['St84b_2'] = 33.34;

      expect(spectator.component.totalPercentage).toBe(100);
    });

    it('should return true for isPercentageSumValid when total is 100%', () => {
      spectator.component.questionCount = 2;
      spectator.component.model['St84b_0'] = 60;
      spectator.component.model['St84b_1'] = 40;

      expect(spectator.component.isPercentageSumValid).toBe(true);
    });

    it('should return false for isPercentageSumValid when total is less than 100%', () => {
      spectator.component.questionCount = 2;
      spectator.component.model['St84b_0'] = 50;
      spectator.component.model['St84b_1'] = 30;

      expect(spectator.component.isPercentageSumValid).toBe(false);
    });

    it('should return false for isPercentageSumValid when total is more than 100%', () => {
      spectator.component.questionCount = 2;
      spectator.component.model['St84b_0'] = 60;
      spectator.component.model['St84b_1'] = 50;

      expect(spectator.component.isPercentageSumValid).toBe(false);
    });

    it('should allow adding shareholders when total is less than 100%', () => {
      spectator.component.questionCount = 1;
      spectator.component.model['St84b_0'] = 80;

      expect(spectator.component.canAddMoreShareholders).toBe(true);
    });

    it('should not allow adding shareholders when total is 100%', () => {
      spectator.component.questionCount = 1;
      spectator.component.model['St84b_0'] = 100;

      expect(spectator.component.canAddMoreShareholders).toBe(false);
    });

    it('should not allow adding shareholders when total exceeds 100%', () => {
      spectator.component.questionCount = 2;
      spectator.component.model['St84b_0'] = 60;
      spectator.component.model['St84b_1'] = 50;

      expect(spectator.component.canAddMoreShareholders).toBe(false);
    });

    it('should mark form as invalid when percentage sum is not 100%', () => {
      spectator.component.questionCount = 1;
      spectator.component.model['St84b_0'] = 80;
      spectator.component['validatePercentageSum']();

      expect(spectator.component.form.valid).toBe(false);
      expect(spectator.component.form.errors).toEqual({ percentageSum: true });
    });

    it('should mark form as valid when percentage sum is 100%', () => {
      spectator.component.questionCount = 1;
      spectator.component.model['St84b_0'] = 100;
      spectator.component.form.markAllAsTouched(); // Make form touched
      spectator.component['validatePercentageSum']();

      expect(spectator.component.form.errors).toBeNull();
    });
  });

  describe('Adding Shareholders', () => {
    beforeEach(() => {
      spectator = createComponent();
      spectator.component.ngOnInit();
    });

    it('should initialize with at least one shareholder field set by default', () => {
      // After initialization, fields are populated with at least one shareholder
      expect(spectator.component.fields.length).toBeGreaterThan(0);
      // Check that the first shareholder fields exist
      const firstShareholderFields = flattenFields(
        spectator.component.fields
      ).filter((field) => {
          return (
            field.key &&
            typeof field.key === 'string' &&
            field.key.endsWith('_0')
          );
        }
      );
      expect(firstShareholderFields.length).toBeGreaterThan(0);
    });

    it('should add a new shareholder when addAnteilseigner is called', () => {
      const initialCount = spectator.component.questionCount;
      const initialFieldsLength = spectator.component.fields.length;

      spectator.component.addAnteilseigner();

      expect(spectator.component.questionCount).toBe(initialCount + 1);
      expect(spectator.component.fields.length).toBeGreaterThan(
        initialFieldsLength
      );
    });

    it('should load existing shareholders from answers on init', () => {
      const answers = {
        St81_0: {
          value: '1',
          type: 'string',
          xmlKey: 'Gesellschafter/Anteilseigner/ZeichnerNummer',
          componentId: 'St81',
          stringValue: '1',
          questionText: '',
          answerText: '',
          headerText: null,
        },
        St84b_0: {
          value: 50,
          type: 'percent',
          xmlKey: 'Gesellschafter/Anteilseigner/Beteiligung/ProzentAnteil',
          componentId: 'St81',
          stringValue: 50,
          questionText: '',
          answerText: '',
          headerText: null,
        },
        St81_1: {
          value: '2',
          type: 'string',
          xmlKey: 'Gesellschafter/Anteilseigner/ZeichnerNummer',
          componentId: 'St81',
          stringValue: '2',
          questionText: '',
          answerText: '',
          headerText: null,
        },
        St84b_1: {
          value: 50,
          type: 'percent',
          xmlKey: 'Gesellschafter/Anteilseigner/Beteiligung/ProzentAnteil',
          componentId: 'St81',
          stringValue: 50,
          questionText: '',
          answerText: '',
          headerText: null,
        },
      };

      spectator = createComponent({
        props: {
          answers: answers,
        },
      });
      spectator.component.ngOnInit();

      expect(spectator.component.questionCount).toBe(2);
    });
  });

  describe('onSubmit cleanup of inactive shareholder branch', () => {
    // The full natural-person branch of a non-first shareholder (St82n/St83a/
    // St83c/St83e are not rendered, so they are not part of the set).
    const NAT_PERSON_KEYS = [
      'St82o_0',
      'St83b_0',
      'St83d_0',
      'St83f_0',
      'St83g_0',
      'St83h_0',
      'St83i_0',
      'St83j_0',
      'St83k_0',
      'St83l_0',
      'St83m_0',
      'GwGeschlecht_0',
      'GwGeburtsort_0',
      'GwStaat_0',
    ];
    // The first shareholder (the applicant) only collects these natural-person
    // fields; the rest are sourced from BundID and therefore not rendered.
    const NAT_PERSON_KEYS_FIRST = ['St82o_0', 'St83g_0'];
    const FIRMA_KEYS = [
      'St82a_0',
      'St82b_0',
      'St82c_0',
      'St82d_0',
      'St82e_0',
      'St82f_0',
      'St82g_0',
      'St82h_0',
      'St82i_0',
    ];
    const SHARED_KEYS = ['St81_0', 'Us4_0', 'St84a_0', 'St84b_0'];

    function prepare(activeType: 'firma' | 'natPerson', persistedKeys: string[]) {
      spectator = createComponent();
      // The presenter passes a flat answer map (key -> value); mirror that on the
      // model directly so the `hide` expressions evaluate against plain strings.
      spectator.component.model = {
        Us4_0: activeType === 'firma' ? 'us4_0Ans-1' : 'us4_0Ans-2',
      };
      spectator.component.answers = persistedAnswers(persistedKeys);
      // Replace the form with an empty (valid) group so onSubmit is not gated by
      // the unrelated required-field / percentage validation.
      spectator.component.form = new FormGroup({});

      const answersRemovedSpy = jest.spyOn(
        spectator.component.answersRemoved,
        'emit'
      );
      const stepCompleteSpy = jest.spyOn(
        spectator.component.stepComplete,
        'emit'
      );
      return { answersRemovedSpy, stepCompleteSpy };
    }

    it('removes persisted natural-person answers when the shareholder is a Firma', async () => {
      const { answersRemovedSpy, stepCompleteSpy } = prepare('firma', [
        ...SHARED_KEYS,
        ...NAT_PERSON_KEYS_FIRST,
      ]);

      await spectator.component.onSubmit();

      expect(answersRemovedSpy).toHaveBeenCalledTimes(1);
      const removed = answersRemovedSpy.mock.calls[0][0] as string[];
      expect(removed).toEqual(expect.arrayContaining(NAT_PERSON_KEYS_FIRST));
      // shared + active (Firma) fields must be kept
      for (const key of [...SHARED_KEYS, ...FIRMA_KEYS]) {
        expect(removed).not.toContain(key);
      }
      expect(stepCompleteSpy).toHaveBeenCalledTimes(1);
    });

    it('removes persisted Firma answers when the shareholder is switched back to a natural person', async () => {
      // Round-trip step 3: the previously persisted Firma branch is now hidden.
      const { answersRemovedSpy, stepCompleteSpy } = prepare('natPerson', [
        ...SHARED_KEYS,
        ...FIRMA_KEYS,
      ]);

      await spectator.component.onSubmit();

      expect(answersRemovedSpy).toHaveBeenCalledTimes(1);
      const removed = answersRemovedSpy.mock.calls[0][0] as string[];
      expect(removed).toEqual(expect.arrayContaining(FIRMA_KEYS));
      // natural-person fields are the active branch now and must not be removed
      for (const key of [...SHARED_KEYS, ...NAT_PERSON_KEYS]) {
        expect(removed).not.toContain(key);
      }
      expect(stepCompleteSpy).toHaveBeenCalledTimes(1);
    });

    it('does not emit answersRemoved when no inactive-branch answers were persisted', async () => {
      const { answersRemovedSpy, stepCompleteSpy } = prepare(
        'firma',
        SHARED_KEYS
      );

      await spectator.component.onSubmit();

      expect(answersRemovedSpy).not.toHaveBeenCalled();
      expect(stepCompleteSpy).toHaveBeenCalledTimes(1);
    });

    it('removes only the inactive branch of each shareholder when there are two', async () => {
      const toIndex1 = (keys: string[]) =>
        keys.map((key) => key.replace(/_0$/, '_1'));

      spectator = createComponent();
      // Grow to two shareholders so fields for index 0 AND 1 are built.
      spectator.component.addAnteilseigner();
      expect(spectator.component.questionCount).toBe(2);

      const sh0Firma = FIRMA_KEYS;
      // Shareholder 0 is the applicant, so only its reduced natural-person set
      // is rendered; shareholder 1 gets the full natural-person branch.
      const sh0NatPerson = NAT_PERSON_KEYS_FIRST;
      const sh1Firma = toIndex1(FIRMA_KEYS);
      const sh1NatPerson = toIndex1(NAT_PERSON_KEYS);
      const shared = [...SHARED_KEYS, ...toIndex1(SHARED_KEYS)];

      // Shareholder 0 = Firma (its natural-person branch is now stale),
      // shareholder 1 = natural person (its Firma branch is now stale).
      spectator.component.model = {
        Us4_0: 'us4_0Ans-1',
        Us4_1: 'us4_1Ans-2',
      };
      // Persist BOTH branches for both shareholders, so the test proves only the
      // inactive branch of each is removed.
      spectator.component.answers = persistedAnswers([
        ...shared,
        ...sh0Firma,
        ...sh0NatPerson,
        ...sh1Firma,
        ...sh1NatPerson,
      ]);
      spectator.component.form = new FormGroup({});

      const answersRemovedSpy = jest.spyOn(
        spectator.component.answersRemoved,
        'emit'
      );
      const stepCompleteSpy = jest.spyOn(
        spectator.component.stepComplete,
        'emit'
      );

      await spectator.component.onSubmit();

      expect(answersRemovedSpy).toHaveBeenCalledTimes(1);
      const removed = answersRemovedSpy.mock.calls[0][0] as string[];
      // stale = shareholder 0's natural-person branch + shareholder 1's Firma branch
      expect(removed).toEqual(
        expect.arrayContaining([...sh0NatPerson, ...sh1Firma])
      );
      // active branches of both shareholders + shared fields must be kept
      for (const key of [...sh0Firma, ...sh1NatPerson, ...shared]) {
        expect(removed).not.toContain(key);
      }
      expect(stepCompleteSpy).toHaveBeenCalledTimes(1);
    });
  });
});
