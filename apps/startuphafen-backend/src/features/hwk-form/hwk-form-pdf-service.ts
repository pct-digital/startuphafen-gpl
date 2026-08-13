import { HwkFormData } from '@startuphafen/startuphafen-common';
import { AntragFormFiller } from '@startuphafen/startuphafen-common/antrag-form-fill';
import { readFile } from 'fs/promises';
import { getAssetPath } from '../../assets-loader';
import { buildAdditionalShareholdersPdf } from './hwk-additional-shareholders-pdf';
import { mapHwkFormDataToAntragFormFields } from './hwk-antrag-form-mapper';
import { mergePdfDocuments } from './hwk-application-pdf';

export class HwkFormPdfService {
  async generateFilledPdf(hwkFormData: HwkFormData): Promise<Uint8Array> {
    const [pdfBuffer, fontBuffer] = await Promise.all([
      readFile(getAssetPath('forms/hwk_antrag_eintragung.pdf')),
      readFile(getAssetPath('forms/fonts/Montserrat-Regular.ttf')),
    ]);

    const fontBytes = new Uint8Array(fontBuffer);
    const filler = await AntragFormFiller.load(new Uint8Array(pdfBuffer), {
      appearanceFontBytes: fontBytes,
    });
    await filler.fill(mapHwkFormDataToAntragFormFields(hwkFormData));
    const formBytes = await filler.save({ lockFields: true });

    const extraPageBytes = await buildAdditionalShareholdersPdf(
      hwkFormData,
      fontBytes
    );
    if (!extraPageBytes) {
      return formBytes;
    }

    return await mergePdfDocuments([formBytes, extraPageBytes]);
  }
}
