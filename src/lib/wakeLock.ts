/**
 * Keeps the screen on during a raid. The lock drops whenever the page is hidden,
 * so it is re-acquired on every return. Returns false when unsupported, so the
 * UI can show the "set auto-lock to Never" tip instead.
 */
export function holdWakeLock(onChange: (held: boolean) => void): () => void {
  const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinel> } };
  if (!nav.wakeLock) {
    onChange(false);
    return () => {};
  }

  let sentinel: WakeLockSentinel | undefined;
  let released = false;

  const acquire = async () => {
    if (released || document.visibilityState !== 'visible') return;
    try {
      sentinel = await nav.wakeLock!.request('screen');
      onChange(true);
      sentinel.addEventListener('release', () => {
        if (!released) onChange(false);
      });
    } catch {
      onChange(false);
    }
  };

  const onVisibility = () => void acquire();
  document.addEventListener('visibilitychange', onVisibility);
  void acquire();

  return () => {
    released = true;
    document.removeEventListener('visibilitychange', onVisibility);
    void sentinel?.release();
  };
}
