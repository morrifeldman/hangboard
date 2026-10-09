import { describe, it, expect } from "vitest";
import {
  buildCampusGymData,
  buildFreeformGymData,
  buildGymData,
  campusRowsFromSets,
  campusRowsToSets,
  campusTemplateRows,
  collectFreeformAutocomplete,
  collectGymAutocomplete,
  emptyCampusRow,
  formatMMSS,
  freeformFingerprint,
  gymDataToFields,
  isFormValid,
  meaningfulFields,
  parseDurationInput,
  sequenceOptionsFor,
} from "../gymForm";
import { GYM_WORKOUTS, CAMPUS_TEMPLATE } from "../../data/gymWorkouts";
import type { GymData, SessionRecord } from "../history";

const def = (id: string) => GYM_WORKOUTS.find((w) => w.id === id)!;

function session(id: string, gymData: GymData): SessionRecord {
  return {
    id,
    workoutType: gymData.type,
    startedAt: 0,
    completedAt: 0,
    bailed: false,
    holds: [],
    gymData,
  } as SessionRecord;
}

describe("buildGymData / isFormValid / gymDataToFields", () => {
  it("requires non-optional fields", () => {
    expect(buildGymData(def("arc"), {})).toBeNull();
    expect(isFormValid(def("arc"), { climbMin: "" })).toBe(false);
    expect(isFormValid(def("arc"), { climbMin: "45" })).toBe(true);
  });

  it("rejects non-numeric numbers, omits blank optionals and parses numbers", () => {
    expect(buildGymData(def("arc"), { climbMin: "abc" })).toBeNull();
    expect(buildGymData(def("arc"), { climbMin: "45", routes: "  ", downclimb: "Some" })).toEqual({
      type: "arc",
      climbMin: 45,
      downclimb: "Some",
    });
  });

  it("splits multi-select values into arrays", () => {
    const gd = buildGymData(def("stretching"), { stretches: "Quads, Calves,," });
    expect(gd).toEqual({ type: "stretching", stretches: ["Quads", "Calves"] });
  });

  it("round-trips through gymDataToFields", () => {
    const fields = { climbMin: "45", routes: "6", downclimb: "Yes", maxGrade: "5.10a" };
    const gd = buildGymData(def("arc"), fields)!;
    expect(gymDataToFields(gd)).toEqual(fields);
    expect(buildGymData(def("arc"), gymDataToFields(gd))).toEqual(gd);

    const stretch = buildGymData(def("stretching"), { stretches: "Quads,Calves", reps: "3" })!;
    expect(gymDataToFields(stretch)).toEqual({ stretches: "Quads,Calves", reps: "3" });
    expect(buildGymData(def("stretching"), gymDataToFields(stretch))).toEqual(stretch);
  });
});

describe("meaningfulFields", () => {
  it("ignores blanks and key order", () => {
    expect(meaningfulFields({ a: "1", b: " ", c: "" })).toBe(meaningfulFields({ a: "1" }));
    expect(meaningfulFields({ a: "1", b: "2" })).toBe(meaningfulFields({ b: "2", a: "1" }));
    expect(meaningfulFields({ a: "1" })).not.toBe(meaningfulFields({ a: "2" }));
  });
});

describe("freeform", () => {
  const blank = [{ name: "", entries: [{ key: "", value: "" }] }];

  it("needs a title and at least one entry", () => {
    expect(buildFreeformGymData("", [{ name: "", entries: [{ key: "a", value: "1" }] }])).toBeNull();
    expect(buildFreeformGymData("Day", blank)).toBeNull();
  });

  it("trims and drops blank entries and empty unnamed sections", () => {
    const gd = buildFreeformGymData(" Day ", [
      { name: " Warm ", entries: [{ key: " a ", value: " 1 " }, { key: "", value: "" }] },
      { name: "", entries: [{ key: "", value: "" }] },
      { name: "Named but empty", entries: [] },
    ]);
    expect(gd).toEqual({
      type: "freeform",
      title: "Day",
      sections: [
        { name: "Warm", entries: [{ key: "a", value: "1" }] },
        { name: "Named but empty", entries: [] },
      ],
    });
  });

  it("fingerprint ignores blank rows and stray spaces but sees real edits", () => {
    const a = freeformFingerprint("Day", [{ name: "S", entries: [{ key: "k", value: "v" }] }]);
    const b = freeformFingerprint(" Day ", [
      { name: " S ", entries: [{ key: " k ", value: "v " }, { key: "", value: "" }] },
      { name: "", entries: [] },
    ]);
    expect(b).toBe(a);
    expect(freeformFingerprint("Day", [{ name: "S", entries: [{ key: "k", value: "w" }] }])).not.toBe(a);
    expect(freeformFingerprint("", blank)).toBe(freeformFingerprint("", []));
  });
});

describe("campus", () => {
  it("returns null when every row is empty", () => {
    expect(buildCampusGymData([{ rung: "", name: " ", sequence: "" }])).toBeNull();
    expect(buildCampusGymData([])).toBeNull();
  });

  it("trims, drops empty rows and omits blank notes", () => {
    expect(
      buildCampusGymData([
        { rung: " Large ", name: "Basic Ladder", sequence: " B1-L2 ", note: "  " },
        { rung: "", name: "", sequence: "" },
        { rung: "Medium", name: "", sequence: "", note: " felt good " },
      ]),
    ).toEqual({
      type: "campus",
      sets: [
        { rung: "Large", name: "Basic Ladder", sequence: "B1-L2" },
        { rung: "Medium", name: "", sequence: "", note: "felt good" },
      ],
    });
  });

  it("never lets the client-only uid reach saved data", () => {
    const gd = buildCampusGymData(campusTemplateRows());
    expect(gd).toEqual({ type: "campus", sets: CAMPUS_TEMPLATE.map((s) => ({ ...s })) });
    expect(JSON.stringify(gd)).not.toContain("uid");
    expect(JSON.stringify(campusRowsToSets(campusTemplateRows()))).not.toContain("uid");
  });

  it("gives every row a distinct uid, so deleting one cannot reassign another", () => {
    const rows = [...campusTemplateRows(), emptyCampusRow(), ...campusRowsFromSets(CAMPUS_TEMPLATE)];
    expect(new Set(rows.map((r) => r.uid)).size).toBe(rows.length);
    const after = rows.filter((_, i) => i !== 1);
    expect(after[1].uid).toBe(rows[2].uid);
  });

  it("collects logged sequences by ladder name and merges with presets", () => {
    const sessions = [
      session("1", { type: "campus", sets: [{ rung: "Large", name: "Basic Ladder", sequence: "X1" }, { rung: "", name: "", sequence: "Z" }] }),
      session("2", { type: "campus", sets: [{ rung: "Large", name: "Basic Ladder", sequence: "X1" }, { rung: "Large", name: "Basic Ladder", sequence: "X2" }] }),
    ];
    const { campusSequences } = collectGymAutocomplete(sessions);
    expect(campusSequences).toEqual({ "Basic Ladder": ["X1", "X2"] });
    const opts = sequenceOptionsFor("Basic Ladder", campusSequences);
    expect(opts).toContain("X1");
    expect(new Set(opts).size).toBe(opts.length);
    expect(sequenceOptionsFor("Nope", {})).toEqual([]);
  });
});

describe("collectFreeformAutocomplete", () => {
  const ff = (id: string, title: string, secName: string, key: string) =>
    session(id, { type: "freeform", title, sections: [{ name: secName, entries: [{ key, value: "1" }] }] });
  const sessions = [
    session("a", { type: "arc", climbMin: 1 } as GymData),
    ff("new", "N", "Zeta", "pull"),
    ff("old", "O", "Alpha", "push"),
  ];

  it("returns sorted keys, section names and the newest freeform", () => {
    const r = collectFreeformAutocomplete(sessions);
    expect(r.keys).toEqual(["pull", "push"]);
    expect(r.sectionNames).toEqual(["Alpha", "Zeta"]);
    expect(r.lastFreeform?.id).toBe("new");
  });

  it("skips the record being edited when picking the last freeform", () => {
    expect(collectFreeformAutocomplete(sessions, "new").lastFreeform?.id).toBe("old");
    expect(collectFreeformAutocomplete(sessions, "old").lastFreeform?.id).toBe("new");
  });
});

describe("durations", () => {
  it("formats m:ss", () => {
    expect(formatMMSS(0)).toBe("0:00");
    expect(formatMMSS(95)).toBe("1:35");
    expect(formatMMSS(300)).toBe("5:00");
  });
  it("parses seconds and m:ss, rejects garbage", () => {
    expect(parseDurationInput("90")).toBe(90);
    expect(parseDurationInput("1:30")).toBe(90);
    expect(parseDurationInput(" ")).toBeNull();
    expect(parseDurationInput("abc")).toBeNull();
    expect(parseDurationInput("a:10")).toBeNull();
  });
});
