import fontkit from '@pdf-lib/fontkit';
import {
  PDFCheckBox,
  PDFDocument,
  PDFFont,
  PDFForm,
  PDFTextField,
} from 'pdf-lib';
import { AntragFormFields } from './entities';

const FIELD_MAP: Record<keyof AntragFormFields, string> = {
  entry_handwerksrolle_checkbox: 'entry_handwerksrolle_checkbox',
  entry_zulassungsfreie_checkbox: 'entry_zulassungsfreie_checkbox',
  entry_handwerksaehnliche_checkbox: 'entry_handwerksaehnliche_checkbox',
  person_a_name: 'person_a_name',
  person_b_name: 'person_b_name',
  person_a_gender_male_checkbox: 'person_a_gender_male_checkbox',
  person_a_gender_female_checkbox: 'person_a_gender_female_checkbox',
  person_b_gender_male_checkbox: 'person_b_gender_male_checkbox',
  person_b_gender_female_checkbox: 'person_b_gender_female_checkbox',
  person_a_nationality: 'person_a_nationality',
  person_b_nationality: 'person_b_nationality',
  person_a_birth_date: 'person_a_birth_date',
  person_a_birth_place: 'person_a_birth_place',
  person_b_birth_date: 'person_b_birth_date',
  person_b_birth_place: 'person_b_birth_place',
  person_a_address: 'person_a_address',
  person_b_address: 'person_b_address',
  legal_form_einzelunternehmen_checkbox:
    'legal_form_einzelunternehmen_checkbox',
  legal_form_gbr_checkbox: 'legal_form_gbr_checkbox',
  legal_form_ohg_checkbox: 'legal_form_ohg_checkbox',
  legal_form_gmbh_checkbox: 'legal_form_gmbh_checkbox',
  legal_form_gmbh_co_kg_checkbox: 'legal_form_gmbh_co_kg_checkbox',
  legal_form_kg_checkbox: 'legal_form_kg_checkbox',
  legal_form_ag_checkbox: 'legal_form_ag_checkbox',
  legal_form_ug_checkbox: 'legal_form_ug_checkbox',
  legal_form_other: 'legal_form_other',
  legal_form_other_checkbox: 'legal_form_other_checkbox',
  commercial_register_no_checkbox: 'commercial_register_no_checkbox',
  commercial_register_company_name: 'commercial_register_company_name',
  commercial_register_yes_checkbox: 'commercial_register_yes_checkbox',
  reason_new_foundation_checkbox: 'reason_new_foundation_checkbox',
  reason_succession_checkbox: 'reason_succession_checkbox',
  reason_change_legal_form_checkbox: 'reason_change_legal_form_checkbox',
  reason_business_expansion_checkbox: 'reason_business_expansion_checkbox',
  relocation_from_address: 'relocation_from_address',
  relocation_checkbox: 'relocation_checkbox',
  predecessor_name_address: 'predecessor_name_address',
  takeover_checkbox: 'takeover_checkbox',
  business_address_street: 'business_address_street',
  business_phone: 'business_phone',
  business_mobile: 'business_mobile',
  business_postcode_city: 'business_postcode_city',
  business_fax: 'business_fax',
  business_email: 'business_email',
  business_internet: 'business_internet',
  business_mailing_address: 'business_mailing_address',
  company_name: 'company_name',
  business_start_date: 'business_start_date',
  branch_addresses: 'branch_addresses',
  main_business_checkbox: 'main_business_checkbox',
  main_business_address: 'main_business_address',
  branch_checkbox: 'branch_checkbox',
  trades_line1: 'trades_line1',
  trades_line2: 'trades_line2',
  trades_line3: 'trades_line3',
  other_activities_line1: 'other_activities_line1',
  other_activities_line2: 'other_activities_line2',
  manager_name: 'manager_name',
  manager_nationality: 'manager_nationality',
  manager_street: 'manager_street',
  manager_postcode_city: 'manager_postcode_city',
  manager_birth_date: 'manager_birth_date',
  manager_birth_place: 'manager_birth_place',
  manager_phone: 'manager_phone',
  manager_mobile: 'manager_mobile',
  manager_email: 'manager_email',
  manager_internet: 'manager_internet',
  exam_date: 'exam_date',
  exam_location: 'exam_location',
  exam_trade: 'exam_trade',
  training_authorization_yes_checkbox: 'training_authorization_yes_checkbox',
  training_authorization_no_checkbox: 'training_authorization_no_checkbox',
  training_authorization_additional_info:
    'training_authorization_additional_info',
  previous_business_details_line1: 'previous_business_details_line1',
  previous_business_yes_checkbox: 'previous_business_yes_checkbox',
  previous_business_details_line2: 'previous_business_details_line2',
  previous_business_no_checkbox: 'previous_business_no_checkbox',
  application_place_date: 'application_place_date',
};

export class AntragFormFiller {
  private pdfDoc: PDFDocument;
  private form: PDFForm;
  private appearanceFont: PDFFont | null;

  private constructor(pdfDoc: PDFDocument, appearanceFont: PDFFont | null) {
    this.pdfDoc = pdfDoc;
    this.form = pdfDoc.getForm();
    this.appearanceFont = appearanceFont;
  }

  static async load(
    data: Uint8Array | ArrayBuffer,
    options: {
      appearanceFontBytes?: Uint8Array | ArrayBuffer;
    } = {}
  ): Promise<AntragFormFiller> {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const pdfDoc = await PDFDocument.load(bytes);
    let appearanceFont: PDFFont | null = null;

    if (options.appearanceFontBytes) {
      const fontBytes =
        options.appearanceFontBytes instanceof Uint8Array
          ? options.appearanceFontBytes
          : new Uint8Array(options.appearanceFontBytes);
      pdfDoc.registerFontkit(fontkit);
      appearanceFont = await pdfDoc.embedFont(fontBytes, { subset: true });
    }

    return new AntragFormFiller(pdfDoc, appearanceFont);
  }

  async fill(values: Partial<AntragFormFields>): Promise<void> {
    for (const key of Object.keys(values) as Array<keyof AntragFormFields>) {
      const rawFieldName = FIELD_MAP[key];
      if (!rawFieldName) continue;
      const value = values[key];
      const field = this.form.getField(rawFieldName);

      if (!field) continue;
      if (field instanceof PDFCheckBox) {
        if (typeof value === 'boolean') {
          if (value) field.check();
          else field.uncheck();
        }
      } else if (field instanceof PDFTextField) {
        if (typeof value === 'string') field.setText(value);
      } else {
        throw new Error(
          `Unsupported field type for field ${rawFieldName} with field instance ${field.constructor.name}.`
        );
      }
    }
  }

  async save(options: { lockFields?: boolean } = {}): Promise<Uint8Array> {
    if (this.appearanceFont) {
      this.form.updateFieldAppearances(this.appearanceFont);
    }

    if (options.lockFields) {
      this.form.flatten();
    }

    return await this.pdfDoc.save({ updateFieldAppearances: false });
  }
}
