import { HEROES } from '../world/cast';

interface Props {
  value: string;
  onChange: (id: string) => void;
}

/** The five heroes as a row of portraits. */
export function HeroPicker({ value, onChange }: Props) {
  const current = HEROES.find((h) => h.id === value) ?? HEROES[0];
  return (
    <div>
      <div className="grid grid-cols-5 gap-2">
        {HEROES.map((h) => {
          const on = h.id === current.id;
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => onChange(h.id)}
              className={`relative aspect-[3/4] overflow-hidden rounded-2xl ring-2 transition active:scale-95 ${
                on ? 'bg-gold/20 ring-gold' : 'bg-black/40 ring-white/10'
              }`}
              aria-pressed={on}
              aria-label={h.label}
            >
              <img src={`/art/portraits/${h.id}.webp`} alt="" className="absolute inset-0 h-full w-full object-contain p-1" />
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-sm text-ash">
        <span className="font-display text-lg text-white">{current.label}</span> · {current.blurb}
      </p>
    </div>
  );
}
