export type NeighborhoodFormStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';

export type NeighborhoodFormFieldType =
  | 'SHORT_TEXT'
  | 'LONG_TEXT'
  | 'SINGLE_CHOICE'
  | 'MULTI_CHOICE'
  | 'NUMBER'
  | 'BOOLEAN';

export const FIELD_TYPE_OPTIONS: Array<{
  value: 'short_text' | 'long_text' | 'single_choice' | 'multi_choice' | 'number' | 'boolean';
  label: string;
}> = [
  { value: 'short_text', label: 'متن کوتاه' },
  { value: 'long_text', label: 'متن بلند' },
  { value: 'single_choice', label: 'یک گزینه' },
  { value: 'multi_choice', label: 'چند گزینه' },
  { value: 'number', label: 'عدد' },
  { value: 'boolean', label: 'بله/خیر' },
];

export function formStatusLabel(status: NeighborhoodFormStatus): string {
  if (status === 'PUBLISHED') return 'منتشر شده';
  if (status === 'CLOSED') return 'بسته';
  return 'پیش‌نویس';
}
