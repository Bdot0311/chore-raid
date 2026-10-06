import { useRef, useState } from 'react';

interface Props {
  label: string;
  onPhoto: (file: File) => Promise<void> | void;
  className?: string;
}

/** Opens the rear camera on phones (a file picker on desktop). */
export function PhotoCapture({ label, onPhoto, className = '' }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button className={className} disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Saving…' : label}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true);
          try {
            await onPhoto(file);
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
