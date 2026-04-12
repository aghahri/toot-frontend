export function formatFileSize(bytes: number): string {
  const n = Math.max(0, bytes);
  if (n < 1024) return `${n} بایت`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10_240 ? 1 : 0).replace(/\.0$/, '')} کیلوبایت`;
  return `${(n / (1024 * 1024)).toFixed(n < 10_485_760 ? 1 : 0).replace(/\.0$/, '')} مگابایت`;
}
