let ctx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  return ctx;
}

// Never rejects: a cue that can't play (context blocked, interrupted on iOS)
// must not surface as an unhandled rejection from a timer callback.
async function beep(freq: number, durationMs: number): Promise<void> {
  try {
    await playTone(freq, durationMs);
  } catch {
    // Audio unavailable — the visual timer still runs.
  }
}

async function playTone(freq: number, durationMs: number): Promise<void> {
  const context = getContext();
  if (context.state !== "running") {
    await context.resume();
  }
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.connect(gain);
  gain.connect(context.destination);

  osc.frequency.value = freq;
  osc.type = "sine";

  const now = context.currentTime;
  gain.gain.setValueAtTime(0.6, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);

  osc.start(now);
  osc.stop(now + durationMs / 1000);
}

// Call once inside a user-gesture handler to unlock the AudioContext on Android
export function initAudio(): void {
  // resume() inside the gesture is what actually unlocks playback on mobile.
  getContext().resume().catch(() => {});
}

export const Audio = {
  prepStart: async () => {
    await beep(523, 80);
    setTimeout(() => beep(659, 100), 120);
  },
  hangStart:   () => beep(880, 120),
  hangEnd:     () => beep(440, 200),
  countdownTick: () => beep(660, 60),
  setComplete: async () => {
    await beep(880, 120);
    setTimeout(() => beep(1100, 150), 180);
  },
  // Rising two-tone to kick off a rest; restEnd is the same pair reversed (falling).
  restStart: async () => {
    await beep(880, 120);
    setTimeout(() => beep(1100, 150), 180);
  },
  restEnd: async () => {
    await beep(1100, 120);
    setTimeout(() => beep(880, 150), 180);
  },
};
