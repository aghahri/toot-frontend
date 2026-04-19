/** Shared geolocation helper (same behavior as direct chat). */
export async function createLocationMetadata(): Promise<{ lat: number; lng: number; label?: string }> {
  if (!navigator.geolocation) {
    throw new Error('Geolocation در این مرورگر پشتیبانی نمی‌شود');
  }
  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 10000,
    });
  });
  const label = window.prompt('برچسب اختیاری مکان (مثلاً محل کار):')?.trim() ?? '';
  return {
    lat: Number(pos.coords.latitude.toFixed(6)),
    lng: Number(pos.coords.longitude.toFixed(6)),
    ...(label ? { label: label.slice(0, 120) } : {}),
  };
}
