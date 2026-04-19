'use client';

import { useMemo } from 'react';
import DatePicker from 'react-multi-date-picker';
import TimePicker from 'react-multi-date-picker/plugins/time_picker';
import DateObject from 'react-date-object';
import persian from 'react-date-object/calendars/persian';
import persian_fa from 'react-date-object/locales/persian_fa';
import gregorian from 'react-date-object/calendars/gregorian';
import gregorian_en from 'react-date-object/locales/gregorian_en';
import { getAppLocale } from '@/lib/locale-date';

import 'react-multi-date-picker/styles/layouts/mobile.css';

type Props = {
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
  id?: string;
};

type DateObjectInstance = InstanceType<typeof DateObject>;

function toIsoFromDateObject(date: DateObjectInstance): string {
  const js = date.toDate();
  if (Number.isNaN(js.getTime())) return '';
  return js.toISOString();
}

export function ScheduledDateTimeField({ value, onChange, disabled, id }: Props) {
  const locale = getAppLocale();
  const isFa = locale === 'fa';
  const calendar = isFa ? persian : gregorian;
  const loc = isFa ? persian_fa : gregorian_en;

  const pickerValue = useMemo(() => {
    if (!value) return undefined;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return undefined;
    return new DateObject({ date: d, calendar, locale: loc });
  }, [value, calendar, loc]);

  return (
    <DatePicker
      calendar={calendar}
      locale={loc}
      value={pickerValue}
      onChange={(date: DateObjectInstance | DateObjectInstance[] | null) => {
        if (!date || Array.isArray(date)) {
          onChange('');
          return;
        }
        onChange(toIsoFromDateObject(date));
      }}
      disabled={disabled}
      format="YYYY/MM/DD HH:mm"
      plugins={[<TimePicker key="tp" position="bottom" hideSeconds />]}
      containerClassName="w-full"
      inputClass="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500/40"
      id={id}
      dir={isFa ? 'rtl' : 'ltr'}
    />
  );
}
