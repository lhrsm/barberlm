// Public VAPID key — safe to ship to the client (public by design).
export const VAPID_PUBLIC_KEY =
  "BNIfIBLPF7AuDTVlONla3Y1MlK7MmLelOpVhUP9UneMN_RVN0Fuzjg3b3b5EFpv1WEfSZqyxcDhogPVf6zQ1aII";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
