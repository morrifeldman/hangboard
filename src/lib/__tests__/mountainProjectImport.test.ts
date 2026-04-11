import { describe, it, expect } from "vitest";
import { extractAttempts, convertStyle, isIndoor, importMountainProjectCSV } from "../mountainProjectImport";

describe("extractAttempts", () => {
  it("returns 1 for empty/undefined notes", () => {
    expect(extractAttempts(undefined)).toBe(1);
    expect(extractAttempts("")).toBe(1);
  });
  it("extracts '3 attempts'", () => {
    expect(extractAttempts("Took 3 attempts to send")).toBe(3);
  });
  it("extracts '5 tries'", () => {
    expect(extractAttempts("5 tries over two days")).toBe(5);
  });
  it("extracts '2 try' (singular try)", () => {
    expect(extractAttempts("2 try")).toBe(2);
  });
  it("extracts ordinal '3rd try' as N-1", () => {
    expect(extractAttempts("3rd try")).toBe(2);
  });
  it("extracts ordinal '2nd go' as N-1", () => {
    expect(extractAttempts("2nd go")).toBe(1);
  });
  it("extracts ordinal '1st try' as 1", () => {
    expect(extractAttempts("1st try")).toBe(1);
  });
  it("extracts 'or so' pattern", () => {
    expect(extractAttempts("10 or so attempts")).toBe(10);
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
    "Date,Route,Rating,Notes,Location,Route Type,Lead Style",
    '2024-03-15,Power Surge,5.12a,"3 attempts, great route",Red River Gorge,Sport,Redpoint',
    "2024-03-16,The Egg,V5,,Planet Rock Gym,Boulder,",
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
    expect(climbs[0].attempts).toBe(3);

    expect(climbs[1].route).toBe("The Egg");
    expect(climbs[1].grade).toBe("V5");
    expect(climbs[1].type).toBe("boulder");
    expect(climbs[1].setting).toBe("indoor");
    expect(climbs[1].style).toBe("attempt"); // no lead style → attempt
  });

  it("skips rows with no grade", async () => {
    const csv = "Date,Route,Rating,Notes,Location,Route Type,Lead Style\n2024-01-01,Test,,,,Sport,\n";
    const file = new File([csv], "t.csv", { type: "text/csv" });
    const climbs = await importMountainProjectCSV(file);
    expect(climbs).toHaveLength(0);
  });
});
