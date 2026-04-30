import { describe, it, expect } from "vitest";
import { parsePitches, convertStyle, isIndoor, importMountainProjectCSV } from "../mountainProjectImport";

describe("parsePitches", () => {
  it("returns 1 for empty/undefined", () => {
    expect(parsePitches(undefined)).toBe(1);
    expect(parsePitches("")).toBe(1);
  });
  it("parses positive integers", () => {
    expect(parsePitches("1")).toBe(1);
    expect(parsePitches("3")).toBe(3);
    expect(parsePitches("12")).toBe(12);
  });
  it("returns 1 for non-numeric", () => {
    expect(parsePitches("abc")).toBe(1);
  });
  it("returns 1 for zero or negative", () => {
    expect(parsePitches("0")).toBe(1);
    expect(parsePitches("-2")).toBe(1);
  });
});

describe("convertStyle", () => {
  it("maps MP lead styles", () => {
    expect(convertStyle("Onsight")).toBe("onsight");
    expect(convertStyle("Flash")).toBe("flash");
    expect(convertStyle("Redpoint")).toBe("redpoint");
    expect(convertStyle("Fell/Hung")).toBe("attempt");
  });
  it("defaults unknown to attempt", () => {
    expect(convertStyle(undefined)).toBe("attempt");
    expect(convertStyle("")).toBe("attempt");
  });
});

describe("isIndoor", () => {
  it("detects gym locations", () => {
    expect(isIndoor("Planet Rock Gym")).toBe(true);
    expect(isIndoor("Indoor Climbing Center")).toBe(true);
  });
  it("returns false for outdoor", () => {
    expect(isIndoor("Red River Gorge")).toBe(false);
    expect(isIndoor(undefined)).toBe(false);
  });
});

describe("importMountainProjectCSV", () => {
  const csvContent = [
    "Date,Route,Rating,Notes,Pitches,Location,Route Type,Lead Style",
    '2024-03-15,Power Surge,5.12a,"3 attempts, great route",3,Red River Gorge,Sport,Redpoint',
    "2024-03-16,The Egg,V5,,1,Planet Rock Gym,Boulder,",
    "",
  ].join("\n");

  it("parses CSV into ClimbRecords", async () => {
    const file = new File([csvContent], "ticks.csv", { type: "text/csv" });
    const climbs = await importMountainProjectCSV(file);
    expect(climbs).toHaveLength(2);

    expect(climbs[0].route).toBe("Power Surge");
    expect(climbs[0].grade).toBe("5.12a");
    expect(climbs[0].type).toBe("sport");
    expect(climbs[0].setting).toBe("outdoor");
    expect(climbs[0].style).toBe("redpoint");
    expect(climbs[0].climbs).toBe(3);

    expect(climbs[1].route).toBe("The Egg");
    expect(climbs[1].grade).toBe("V5");
    expect(climbs[1].type).toBe("boulder");
    expect(climbs[1].setting).toBe("indoor");
    expect(climbs[1].style).toBe("attempt"); // no lead style → attempt
    expect(climbs[1].climbs).toBe(1);
  });

  it("defaults missing Pitches to 1", async () => {
    const csv = [
      "Date,Route,Rating,Notes,Pitches,Location,Route Type,Lead Style",
      "2024-03-15,No Pitches,5.10a,,,Red River Gorge,Sport,Onsight",
      "",
    ].join("\n");
    const file = new File([csv], "t.csv", { type: "text/csv" });
    const climbs = await importMountainProjectCSV(file);
    expect(climbs).toHaveLength(1);
    expect(climbs[0].climbs).toBe(1);
  });

  it("skips rows with no grade", async () => {
    const csv = "Date,Route,Rating,Notes,Pitches,Location,Route Type,Lead Style\n2024-01-01,Test,,,1,,Sport,\n";
    const file = new File([csv], "t.csv", { type: "text/csv" });
    const climbs = await importMountainProjectCSV(file);
    expect(climbs).toHaveLength(0);
  });
});
