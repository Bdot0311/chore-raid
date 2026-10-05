export function newId(): string {
  // randomUUID needs a secure context; LAN testing over plain http doesn't have one.
  if (globalThis.isSecureContext && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
