export const Haptics = {
  hangStart:   () => navigator.vibrate?.([100]),
  hangEnd:     () => navigator.vibrate?.([200]),
  tick:        () => navigator.vibrate?.([30]),
  setComplete: () => navigator.vibrate?.([100, 50, 200]),
};
