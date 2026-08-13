import { readFile } from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { AntragFormFiller } from './antrag-form-fill';

describe('AntragFormFiller', () => {
  it('keeps uppercase sharp s unchanged in text fields', async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([300, 300]);
    const form = pdfDoc.getForm();
    const textField = form.createTextField('person_a_name');
    textField.addToPage(page, {
      x: 20,
      y: 250,
      width: 260,
      height: 20,
    });

    const bytes = await pdfDoc.save();
    const fontBytes = await readFile(
      path.resolve(
        __dirname,
        '../../../../apps/startuphafen-backend/src/assets/forms/fonts/Montserrat-Regular.ttf'
      )
    );
    const filler = await AntragFormFiller.load(bytes, {
      appearanceFontBytes: new Uint8Array(fontBytes),
    });

    await filler.fill({ person_a_name: 'Straẞe' });
    const filledBytes = await filler.save();

    const filledDoc = await PDFDocument.load(filledBytes);
    const filledField = filledDoc.getForm().getTextField('person_a_name');

    expect(filledField.getText()).toBe('Straẞe');
  });

  it('flattens fields when lockFields is enabled', async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([300, 300]);
    const form = pdfDoc.getForm();
    const textField = form.createTextField('person_a_name');
    textField.addToPage(page, {
      x: 20,
      y: 250,
      width: 260,
      height: 20,
    });

    const bytes = await pdfDoc.save();
    const filler = await AntragFormFiller.load(bytes);

    await filler.fill({ person_a_name: 'Nicht editierbar' });
    const filledBytes = await filler.save({ lockFields: true });

    const flattenedDoc = await PDFDocument.load(filledBytes);
    const flattenedForm = flattenedDoc.getForm();

    expect(flattenedForm.getFields()).toHaveLength(0);
  });
});
