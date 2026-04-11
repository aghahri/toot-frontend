export function calendarDayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function dayDividerLabelFa(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const todayK = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yK = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
  const k = calendarDayKey(iso);
  if (k === todayK) return 'امروز';
  if (k === yK) return 'دیروز';
  return d.toLocaleDateString('fa-IR', { dateStyle: 'medium' });
}
