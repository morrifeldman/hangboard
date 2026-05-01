import { Audio } from "../lib/audio";
import { Haptics } from "../lib/haptics";

export function useAudio() {
  return {
    prepStart: () => {
      Audio.prepStart();
    },
    hangStart: () => {
      Audio.hangStart();
      Haptics.hangStart();
    },
    hangEnd: () => {
      Audio.hangEnd();
      Haptics.hangEnd();
    },
    countdownTick: () => {
      Audio.countdownTick();
      Haptics.tick();
    },
    setComplete: () => {
      Audio.setComplete();
      Haptics.setComplete();
    },
  };
}
