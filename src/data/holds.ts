export interface HoldDefinition {
  id: string;
  name: string;
  defaultSet1Weight: number;
  defaultSet2Weight: number;
  set1Reps: number;
  set2Reps: number;
  skipProgression?: boolean;
}

export const HOLDS: HoldDefinition[] = [
  { id: "jug",         name: "Jug",         defaultSet1Weight:  0,    defaultSet2Weight:  0,    set1Reps: 7, set2Reps: 6, skipProgression: true },
  { id: "large-edge",  name: "Large Edge",  defaultSet1Weight:  5,    defaultSet2Weight:  15,   set1Reps: 7, set2Reps: 6 },
  { id: "mr-shallow",  name: "MR Shallow",  defaultSet1Weight: -35,   defaultSet2Weight: -25,   set1Reps: 7, set2Reps: 6 },
  { id: "small-edge",  name: "Small Edge",  defaultSet1Weight: -20,   defaultSet2Weight: -10,   set1Reps: 7, set2Reps: 6 },
  { id: "imr-shallow", name: "IMR Shallow", defaultSet1Weight:  10,   defaultSet2Weight:  0,    set1Reps: 7, set2Reps: 6 },
  { id: "wide-pinch",  name: "Wide Pinch",  defaultSet1Weight: -45,   defaultSet2Weight: -35,   set1Reps: 7, set2Reps: 6 },
  { id: "sloper",      name: "Sloper",      defaultSet1Weight: -17.5, defaultSet2Weight: -7.5,  set1Reps: 7, set2Reps: 6 },
  { id: "med-pinch",   name: "Med Pinch",   defaultSet1Weight: -50,   defaultSet2Weight: -40,   set1Reps: 7, set2Reps: 6 },
];
