import {
  FormDataField,
  FormDataInput,
  FormDataItem,
  FormDataNode,
  ValueType,
} from '../entities';
import formDataTemplate from './formDataTemplate.json';

export class FormDataBuilder {
  private template: FormDataItem[] = formDataTemplate as FormDataItem[];

  build(data: FormDataInput): FormDataNode[] {
    const processedItems = this.processItems(this.template, data);

    const processedUpdatedItems = processedItems.find(
      (item) => item.name === 'Betriebsdaten'
    );

    if (processedUpdatedItems && 'formItems' in processedUpdatedItems) {
      processedUpdatedItems.formItems.push(
        {
          name: 'Hauptniederlassung',
          label: 'Hauptniederlassung',
          booleanValue: true,
        },
        {
          name: 'Neugründung',
          label: 'Neugründung',
          booleanValue: true,
        }
      );
    }

    return processedItems;
  }

  private processItems(items: FormDataItem[], data: FormDataInput): any[] {
    return items.map((item) => {
      if ('formItems' in item) {
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
