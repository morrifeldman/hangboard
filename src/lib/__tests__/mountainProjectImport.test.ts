import { describe, it, expect } from "vitest";
import {
  parsePitches,
  convertStyle,
  isIndoor,
  parseMountainProjectCSV,
  importMountainProjectCSV,
  hasMountainProjectHeaders,
} from "../mountainProjectImport";

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

describe("hasMountainProjectHeaders", () => {
  it("accepts a real Mountain Project header row", () => {
    expect(
      hasMountainProjectHeaders(
        'Date,Route,Rating,Notes,URL,Pitches,Location,"Avg Stars","Your Stars","Style","Lead Style","Route Type","Your Rating","Length","Rating Code"\n2024-03-15,Power Surge,5.12a,,,,,,,,,,,,\n',
      ),
    ).toBe(true);
  });

  it("accepts a header row with a UTF-8 BOM and CRLF line endings", () => {
    expect(hasMountainProjectHeaders("\uFEFFDate,Route,Rating,Location\r\n")).toBe(true);
  });

  it("rejects the JavaScript source of the serverless handler", () => {
    // What Vite's dev server used to return for /api/fetch-mp-csv.
    const js = [
      "export default async function handler(req, res) {",
      "  if (req.method !== 'GET') {",
      "    return res.status(405).json({ error: 'Method not allowed' });",
      "  }",
      "}",
    ].join("\n");
    expect(hasMountainProjectHeaders(js)).toBe(false);
  });

  it("rejects an HTML error page", () => {
    expect(
      hasMountainProjectHeaders("<!DOCTYPE html>\n<html><body>404 Not Found</body></html>"),
    ).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(hasMountainProjectHeaders("")).toBe(false);
    expect(hasMountainProjectHeaders("   \n  ")).toBe(false);
  });

  it("rejects a CSV missing the columns the importer reads", () => {
    expect(hasMountainProjectHeaders("Date,Location,Notes\n2024-01-01,Somewhere,\n")).toBe(false);
    expect(hasMountainProjectHeaders("Date,Route,Location\n")).toBe(false);
  });
});

describe("CSV parsing edge cases", () => {
  const H = "Date,Route,Rating,Notes,Pitches,Location,Route Type,Lead Style";

  it("handles quoted newlines, escaped quotes and commas in Notes", () => {
    const csv = `${H}\n2024-03-15,Power,5.12a,"line1\nsaid ""hi"", ok",1,Crag,Sport,Redpoint\n2024-03-16,Next,5.10a,,1,Crag,Sport,Onsight\n`;
    const out = parseMountainProjectCSV(csv);
    expect(out).toHaveLength(2);
    expect(out[0].notes).toBe('line1\nsaid "hi", ok');
    expect(out[1].route).toBe("Next");
  });

  it("handles CRLF, BOM and trailing newline", () => {
    const csv = `\uFEFF${H}\r\n2024-03-15,Power,5.12a,n,1,Crag,Sport,Redpoint\r\n`;
    const out = parseMountainProjectCSV(csv);
    expect(out).toHaveLength(1);
    expect(out[0].notes).toBe("n");
    expect(out[0].style).toBe("redpoint");
  });

  it("normalizes dates and falls back for junk", () => {
    const csv = [
      H,
      "3/5/2024,A,5.10a,,1,,Sport,",
      "2024-03-07T10:20:00Z,B,5.10a,,1,,Sport,",
      "2024-03-08,C,5.10a,,1,,Sport,",
      "garbage,D,5.10a,,1,,Sport,",
    ].join("\n");
    const out = parseMountainProjectCSV(csv);
    expect(out.map((c) => c.date).slice(0, 3)).toEqual(["2024-03-05", "2024-03-07", "2024-03-08"]);
    expect(out[3].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(out[3].date).not.toBe("garbage");
  });

  it("matches gym as a whole word only", () => {
    expect(isIndoor("Gymnasium Rock")).toBe(false);
    expect(isIndoor("Brooklyn Boulders gym")).toBe(true);
    expect(isIndoor("Indoor wall")).toBe(true);
  });
});
