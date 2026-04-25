/**
 * Push-device registration client (Phase N1).
 *
 * Pure HTTP wrappers around the backend `/devices` endpoints. No service
 * worker, no Firebase web SDK calls happen here — those live in the platform
 * adapter layer that the Android shell / web push integration will call into.
 *
 * Contract:
 *   1. The host (Android shell, web SW, etc.) obtains an FCM token by its
 *      own means.
 *   2. It calls registerDevice({ token, platform: 'ANDROID' | 'WEB' }) on
 *      sign-in and on token refresh — the backend uniqueness on (provider,
 *      token) makes repeat calls idempotent.
 *   3. On sign-out the host calls unregisterDevice(deviceId) with the id
 *      returned from registerDevice so the row is dropped cleanly.
 */

import { apiFetch } from './api';

export type DevicePlatform = 'ANDROID' | 'IOS' | 'WEB';

export interface RegisterDeviceInput {
  /** FCM registration token from the platform SDK / SW. */
  token: string;
  platform: DevicePlatform;
  /** Android package name / iOS bundle id / web origin (optional). */
  appId?: string;
  /** BCP-47 locale, optional. */
  locale?: string;
  /** Client app version string, optional. */
  appVersion?: string;
}

export interface RegisteredDevice {
  id: string;
  platform: DevicePlatform;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceListItem {
  id: string;
  platform: DevicePlatform;
  appId: string | null;
  appVersion: string | null;
  locale: string | null;
  disabled: boolean;
  lastSeenAt: string;
  createdAt: string;
}

export function registerDevice(input: RegisterDeviceInput): Promise<RegisteredDevice> {
  return apiFetch<RegisteredDevice>('devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function unregisterDevice(deviceId: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`devices/${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
  });
}

export function listDevices(): Promise<DeviceListItem[]> {
  return apiFetch<DeviceListItem[]>('devices', { method: 'GET' });
}
