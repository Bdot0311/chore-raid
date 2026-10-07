/** Shared button styles: chunky, glossy, with a pressed state, like a mobile game. */
export const btn = {
  primary:
    'block w-full rounded-2xl bg-gradient-to-b from-[#ff8a5c] to-ember py-4 text-center font-display text-xl tracking-wide text-dungeon-950 shadow-[inset_0_2px_0_rgba(255,255,255,0.4),0_5px_0_#a8391a,0_10px_24px_rgba(255,107,61,0.3)] transition active:translate-y-1 active:shadow-[inset_0_2px_0_rgba(255,255,255,0.4),0_1px_0_#a8391a] disabled:opacity-50',
  secondary:
    'block w-full rounded-2xl bg-dungeon-800 py-4 text-center font-display text-xl tracking-wide text-bone shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_5px_0_#0d0b1a] ring-1 ring-white/10 transition active:translate-y-1 active:shadow-none',
  gold:
    'block w-full rounded-2xl bg-gradient-to-b from-[#ffe08a] to-gold py-4 text-center font-display text-xl tracking-wide text-dungeon-950 shadow-[inset_0_2px_0_rgba(255,255,255,0.5),0_5px_0_#b8861c,0_10px_24px_rgba(255,201,77,0.3)] transition active:translate-y-1 active:shadow-none',
  ghost: 'rounded-xl px-3 py-2 text-sm font-semibold text-ash active:bg-white/10',
  stepper:
    'h-14 w-14 rounded-2xl bg-gradient-to-b from-dungeon-600 to-dungeon-800 text-3xl font-bold text-bone shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_4px_0_#0d0b1a] active:translate-y-1 active:shadow-none transition',
};

export const panel = 'rounded-3xl bg-black/45 p-4 ring-1 ring-white/10 backdrop-blur-md';
