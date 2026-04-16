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

const STATUS_META: Record<
  NeighborhoodFormStatus,
  { label: string; className: string }
> = {
  DRAFT: {
    label: 'پیش‌نویس',
    className: 'bg-amber-50 text-amber-800 ring-amber-200/80',
  },
  PUBLISHED: {
    label: 'منتشر شده',
    className: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
  },
  CLOSED: {
    label: 'بسته',
    className: 'bg-slate-100 text-slate-700 ring-slate-200/80',
  },
};

export function formStatusLabel(status: NeighborhoodFormStatus): string {
  return STATUS_META[status]?.label ?? status;
}

export function formStatusBadgeClass(status: NeighborhoodFormStatus): string {
  return STATUS_META[status]?.className ?? 'bg-slate-100 text-slate-700 ring-slate-200/80';
}

export function fieldTypeLabel(type: NeighborhoodFormFieldType): string {
  if (type === 'SHORT_TEXT') return 'پاسخ کوتاه';
  if (type === 'LONG_TEXT') return 'پاسخ بلند';
  if (type === 'SINGLE_CHOICE') return 'انتخاب یک گزینه';
  if (type === 'MULTI_CHOICE') return 'انتخاب چند گزینه';
  if (type === 'NUMBER') return 'عدد';
  return 'بله / خیر';
}

export function fieldHelperText(type: NeighborhoodFormFieldType): string {
  if (type === 'SHORT_TEXT') return 'پاسخ کوتاه و مستقیم وارد کنید.';
  if (type === 'LONG_TEXT') return 'جزئیات را کامل‌تر بنویسید.';
  if (type === 'SINGLE_CHOICE') return 'یکی از گزینه‌ها را انتخاب کنید.';
  if (type === 'MULTI_CHOICE') return 'می‌توانید چند گزینه انتخاب کنید.';
  if (type === 'NUMBER') return 'فقط مقدار عددی قابل قبول است.';
  return 'وضعیت را به صورت بله یا خیر ثبت کنید.';
}
