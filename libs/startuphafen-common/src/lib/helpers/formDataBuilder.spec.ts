import { FormDataInput } from '../entities';
import { FormDataBuilder } from './formDataBuilder';

// Helper: find a built node/field by its `name` within a list of built items.
function findByName(items: any[], name: string): any {
  return items.find((item) => item.name === name);
}

function makeBeteiligter(suffix: string) {
  return {
    Vorname: `Vorname${suffix}`,
    Nachname: `Nachname${suffix}`,
    Geburtsdatum: `2000-01-0${suffix}`,
    SteuerId: `SteuerId${suffix}`,
    Adresse: {
      Straße: `Straße${suffix}`,
      Hausnummer: `Hausnummer${suffix}`,
      PLZ: `PLZ${suffix}`,
      Ort: `Ort${suffix}`,
    },
    Geburtsort: `Geburtsort${suffix}`,
    Staatsangehörigkeit: `Staat${suffix}`,
    Geschlecht: `Geschlecht${suffix}`,
  };
}

// Build a minimal FormDataInput that only carries the data we assert on. The
// builder reads defensively (missing keys become empty values), so a partial
// object cast is enough to exercise the array serialization.
function makeInput(beteiligte: unknown): FormDataInput {
  return {
    Betriebsdaten: {
      Beteiligte: beteiligte,
    },
  } as unknown as FormDataInput;
}

describe('FormDataBuilder', () => {
  const builder = new FormDataBuilder();

  it('serializes a Beteiligte array into one repeated node per participant (kapg)', () => {
    const built = builder.build(
      makeInput([makeBeteiligter('1'), makeBeteiligter('2')]),
      'kapg'
    );

    const betriebsdaten = findByName(built, 'Betriebsdaten');
    const beteiligte = findByName(betriebsdaten.formItems, 'Beteiligte');

    expect(beteiligte).toBeDefined();
    expect(beteiligte.formItems).toHaveLength(2);

    const [first, second] = beteiligte.formItems;
    // Sibling participant nodes must carry unique names, otherwise a name-keyed
    // consumer on the OZG side collides them (root cause of the /antrag 500).
    expect(first.name).toBe('Beteiligte_1');
    expect(first.label).toBe('Beteiligte 1');
    expect(second.name).toBe('Beteiligte_2');
    expect(second.label).toBe('Beteiligte 2');

    // All scalar fields of the first participant land in the output.
    expect(findByName(first.formItems, 'Vorname').stringValue).toBe('Vorname1');
    expect(findByName(first.formItems, 'Nachname').stringValue).toBe(
      'Nachname1'
    );
    expect(findByName(first.formItems, 'Geburtsdatum').stringValue).toBe(
      '2000-01-01'
    );
    expect(findByName(first.formItems, 'SteuerId').stringValue).toBe(
      'SteuerId1'
    );
    expect(findByName(first.formItems, 'Geburtsort').stringValue).toBe(
      'Geburtsort1'
    );
    expect(findByName(first.formItems, 'Staatsangehörigkeit').stringValue).toBe(
      'Staat1'
    );
    expect(findByName(first.formItems, 'Geschlecht').stringValue).toBe(
      'Geschlecht1'
    );

    // The nested Adresse object is preserved as a sub-node with all fields.
    const adresse = findByName(first.formItems, 'Adresse');
    expect(adresse.formItems).toBeDefined();
    expect(findByName(adresse.formItems, 'Straße').stringValue).toBe('Straße1');
    expect(findByName(adresse.formItems, 'Hausnummer').stringValue).toBe(
      'Hausnummer1'
    );
    expect(findByName(adresse.formItems, 'PLZ').stringValue).toBe('PLZ1');
    expect(findByName(adresse.formItems, 'Ort').stringValue).toBe('Ort1');

    // Second participant carries its own values, not the first one's.
    expect(findByName(second.formItems, 'Vorname').stringValue).toBe(
      'Vorname2'
    );
  });

  it('serializes a single Beteiligter (no additional Mitgründer case) for kapg', () => {
    const built = builder.build(makeInput([makeBeteiligter('1')]), 'kapg');

    const betriebsdaten = findByName(built, 'Betriebsdaten');
    const beteiligte = findByName(betriebsdaten.formItems, 'Beteiligte');

    expect(beteiligte.formItems).toHaveLength(1);
    expect(beteiligte.formItems[0].label).toBe('Beteiligte 1');
    expect(
      findByName(beteiligte.formItems[0].formItems, 'Vorname').stringValue
    ).toBe('Vorname1');
  });

  it('produces an empty Beteiligte node for an empty array without crashing', () => {
    const built = builder.build(makeInput([]), 'kapg');

    const betriebsdaten = findByName(built, 'Betriebsdaten');
    const beteiligte = findByName(betriebsdaten.formItems, 'Beteiligte');

    expect(beteiligte).toBeDefined();
    expect(beteiligte.formItems).toEqual([]);
  });

  it('keeps non-array object nodes and scalar fields unchanged', () => {
    const input = {
      antragsteller: { pers_vorname: 'Max' },
      Betriebsdaten: {
        Betriebsstätte: {
          Straße: 'Hauptstraße',
          Hausnummer: '1',
          PLZ: '12345',
          Ort: 'Kiel',
        },
        Beteiligte: [makeBeteiligter('1')],
      },
      source: 'startuphafen.sh',
    } as unknown as FormDataInput;

    const built = builder.build(input, 'kapg');

    // Scalar field at the top level still serializes.
    expect(findByName(built, 'source').stringValue).toBe('startuphafen.sh');

    // Nested object node (not an array) still serializes as a single node.
    const betriebsdaten = findByName(built, 'Betriebsdaten');
    const betriebsstaette = findByName(
      betriebsdaten.formItems,
      'Betriebsstätte'
    );
    expect(findByName(betriebsstaette.formItems, 'Straße').stringValue).toBe(
      'Hauptstraße'
    );
    expect(findByName(betriebsstaette.formItems, 'Ort').stringValue).toBe(
      'Kiel'
    );

    // antragsteller node still serializes its fields.
    const antragsteller = findByName(built, 'antragsteller');
    expect(
      findByName(antragsteller.formItems, 'pers_vorname').stringValue
    ).toBe('Max');
  });
});
