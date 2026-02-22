const TEST_MODE = import.meta.env.VITE_TEST_MODE === "true";

let ctx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  return ctx;
}

async function beep(freq: number, durationMs: number): Promise<void> {
  if (TEST_MODE) return;
  const context = getContext();
  if (context.state === "suspended") {
    await context.resume();
  }
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.connect(gain);
  gain.connect(context.destination);

  osc.frequency.value = freq;
  osc.type = "sine";

  const now = context.currentTime;
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);

  osc.start(now);
  osc.stop(now + durationMs / 1000);
}

// Call once inside a user-gesture handler to unlock the AudioContext on Android
export function initAudio(): void {
  if (TEST_MODE) return;
  getContext();
}

export const Audio = {
  hangStart:   () => beep(880, 120),
  hangEnd:     () => beep(440, 200),
  countdownTick: () => beep(660, 60),
  setComplete: async () => {
    await beep(880, 120);
    setTimeout(() => beep(1100, 150), 180);
  },
};
