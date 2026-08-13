import {
  FormDataField,
  FormDataInput,
  FormDataItem,
  FormDataNode,
  ValueType,
} from '../entities';
import formDataTemplateEun from './formDataTemplateEun.json';
import formDataTemplateKapG from './formDataTemplateKapG.json';

export class FormDataBuilder {
  private templateEun: FormDataItem[] = formDataTemplateEun as FormDataItem[];
  private templateKapG: FormDataItem[] = formDataTemplateKapG as FormDataItem[];

  build(data: FormDataInput, catalogueId: string): FormDataNode[] {
    let processedItems: any[] = [];
    switch (catalogueId) {
      case 'eun':
        processedItems = this.processItems(this.templateEun, data);

        break;
      case 'kapg':
        processedItems = this.processItems(this.templateKapG, data);

        break;
      default:
        return [];
    }

    const processedUpdatedItems = processedItems.find(
      (item) => item.name === 'Betriebsdaten'
    );

    if (processedUpdatedItems && 'formItems' in processedUpdatedItems) {
      processedUpdatedItems.formItems.push(
        {
          name: 'Hauptniederlassung',
          label: 'Hauptniederlassung',
          stringValue: 'Ja',
        },
        {
          name: 'Neugründung',
          label: 'Neugründung',
          stringValue: 'Ja',
        }
      );
    }

    return processedItems;
  }

  private processItems(items: FormDataItem[], data: FormDataInput): any[] {
    return items.map((item) => {
      if ('formItems' in item) {
        if (Array.isArray((data as Record<string, any>)?.[item.name])) {
          return this.processArrayNode(item, data);
        }
        return this.processNode(item, data);
      } else {
        return this.processField(item, data);
      }
    });
  }

  private processNode(node: FormDataNode, data: Record<string, any>) {
    const nodeData = data[node.name] || {};
    return {
      name: node.name,
      label: node.label,
      formItems: this.processItems(node.formItems, nodeData),
    };
  }

  private processArrayNode(node: FormDataNode, data: Record<string, any>) {
    const elements: any[] = Array.isArray(data[node.name])
      ? data[node.name]
      : [];
    return {
      name: node.name,
      label: node.label,
      formItems: elements.map((element, idx) => ({
        name: `${node.name}_${idx + 1}`,
        label: `${node.label} ${idx + 1}`,
        formItems: this.processItems(node.formItems, element),
      })),
    };
  }

  private processField(field: FormDataField, data: Record<string, any>) {
    const value = data[field.name];
    const valueKey = `${field.type}Value`;

    return {
      name: field.name,
      label: field.label,
      [valueKey]: this.formatValue(field.type, value) ?? '',
    };
  }

  private formatValue(
    type: ValueType,
    value: Date | string | boolean | null
  ): Date | string | boolean {
    switch (type) {
      case 'date':
        return value instanceof Date
          ? value.toISOString().split('T')[0]
          : (value as string);
      case 'boolean':
        return Boolean(value);
      default:
        return value?.toString() || '';
    }
  }
}
