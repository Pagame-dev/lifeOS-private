import { supabase } from '@/lib/supabase';

const VAPID_PUBLIC_KEY = 'BDr30v0-NlDiDzPB2wBMp9rS07ReXJwlrfYL9UaD2WRyo577EAdJDQdDnrVj-UhTuyTWBA6PbueLCDvaVpvyCWA';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

export function getNotificationPermission(): PermissionState {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission as PermissionState;
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  await sendSubscriptionToServer(subscription);
  return subscription;
}

async function sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) return;

  const sub = subscription.toJSON();
  const deviceLabel = detectDeviceLabel();

  await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: sub.keys,
      deviceLabel,
      userAgent: navigator.userAgent,
    }),
  });
}

function detectDeviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Mac/.test(ua)) return 'Mac';
  return 'Browser';
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
  }
}

export async function sendTestNotification(): Promise<{ success: boolean; error?: string; sent?: number }> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) return { success: false, error: 'Not authenticated' };

  try {
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Request failed' }));
      return { success: false, error: data.error || `Failed (${res.status})` };
    }
    const data = await res.json();
    return { success: true, sent: data.sent as number };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function hasActiveSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return !!subscription;
}

export async function setBadge(count: number): Promise<void> {
  if ('setAppBadge' in navigator) {
    try {
      await (navigator as unknown as { setAppBadge: (n: number) => Promise<void> }).setAppBadge(count);
    } catch { /* ignore */ }
  }
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SET_BADGE', count });
  }
}

export async function clearBadge(): Promise<void> {
  if ('clearAppBadge' in navigator) {
    try {
      await (navigator as unknown as { clearAppBadge: () => Promise<void> }).clearAppBadge();
    } catch { /* ignore */ }
  }
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_BADGE' });
  }
}

export interface PushDiagnostics {
  browserSupported: boolean;
  pwaInstalled: boolean;
  permissionGranted: boolean;
  subscriptionActive: boolean;
  isIOS: boolean;
  isStandalone: boolean;
}

export async function getDiagnostics(): Promise<PushDiagnostics> {
  const browserSupported = isPushSupported();
  const standalone = isStandalone();
  const permissionGranted = getNotificationPermission() === 'granted';
  const subscriptionActive = await hasActiveSubscription();
  return {
    browserSupported,
    pwaInstalled: standalone,
    permissionGranted,
    subscriptionActive,
    isIOS: isIOS(),
    isStandalone: standalone,
  };
}
