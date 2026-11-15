import { describe, expect, it } from "vitest";
import { parseMpUserSearch, tickExportUrlFrom } from "../mpAccount";

const EXPORT = "https://www.mountainproject.com/user/200938052/morri-feldman/tick-export";

describe("tickExportUrlFrom", () => {
  it("keeps a tick-export URL", () => {
    expect(tickExportUrlFrom(EXPORT)).toBe(EXPORT);
    expect(tickExportUrlFrom(`  ${EXPORT}  `)).toBe(EXPORT);
  });

  it("builds the export URL from a profile link", () => {
    expect(tickExportUrlFrom("https://www.mountainproject.com/user/200938052/morri-feldman")).toBe(EXPORT);
    expect(tickExportUrlFrom("https://www.mountainproject.com/user/200938052/morri-feldman/ticks")).toBe(EXPORT);
    expect(
      tickExportUrlFrom("https://www.mountainproject.com/user/200938052/morri-feldman?search=1&type=user"),
    ).toBe(EXPORT);
    expect(tickExportUrlFrom("mountainproject.com/user/200938052/morri-feldman")).toBe(EXPORT);
    expect(tickExportUrlFrom("http://MountainProject.com/user/200938052/morri-feldman/")).toBe(EXPORT);
  });

  it("fills in a name when the link or input has only an id", () => {
    const bare = "https://www.mountainproject.com/user/200938052/user/tick-export";
    expect(tickExportUrlFrom("200938052")).toBe(bare);
    expect(tickExportUrlFrom("https://www.mountainproject.com/user/200938052")).toBe(bare);
    expect(tickExportUrlFrom("https://www.mountainproject.com/user/200938052/tick-export")).toBe(bare);
  });

  it("refuses anything else", () => {
    expect(tickExportUrlFrom("")).toBeNull();
    expect(tickExportUrlFrom("   ")).toBeNull();
    expect(tickExportUrlFrom("morri feldman")).toBeNull();
    expect(tickExportUrlFrom("https://example.com/ticks.csv")).toBeNull();
    expect(tickExportUrlFrom("https://example.com/user/200938052/morri-feldman/tick-export")).toBeNull();
    expect(tickExportUrlFrom("https://mountainproject.com.evil.test/user/1/x/tick-export")).toBeNull();
    expect(tickExportUrlFrom("https://www.mountainproject.com/route/105717718/power-surge")).toBeNull();
    expect(tickExportUrlFrom("https://www.mountainproject.com/user/abc/name")).toBeNull();
  });
});

function snippet(href: string, name: string, location = ""): string {
  return (
    `<a href="${href}?search=1&amp;type=user&amp;method=resultsPage&amp;query=Morri">\n` +
    `    <img class="user-img-avatar" src=""/>\n` +
    `    <div class="text-truncate">${name}</div>\n` +
    `    <div class="text-warm text-truncate small">${location}</div>\n` +
    `</a>\n`
  );
}

describe("parseMpUserSearch", () => {
  it("reads id, name and location out of each result", () => {
    const body = {
      categories: [],
      results: {
        Users: [
          snippet("https://www.mountainproject.com/user/200938052/morri-feldman", "Morri Feldman", "Boulder, CO"),
          snippet("https://www.mountainproject.com/user/200216463/mo-morri", "Mo Morri"),
        ],
      },
    };
    expect(parseMpUserSearch(body)).toEqual([
      {
        id: "200938052",
        name: "Morri Feldman",
        location: "Boulder, CO",
        profileUrl: "https://www.mountainproject.com/user/200938052/morri-feldman",
        tickExportUrl: EXPORT,
      },
      {
        id: "200216463",
        name: "Mo Morri",
        location: "",
        profileUrl: "https://www.mountainproject.com/user/200216463/mo-morri",
        tickExportUrl: "https://www.mountainproject.com/user/200216463/mo-morri/tick-export",
      },
    ]);
  });

  it("points sister-site results back at Mountain Project", () => {
    const [user] = parseMpUserSearch({
      results: { Users: [snippet("https://www.mtbproject.com/user/200895291/john-smith", "John Smith")] },
    });
    expect(user.tickExportUrl).toBe("https://www.mountainproject.com/user/200895291/john-smith/tick-export");
  });

  it("decodes entities in names and drops markup", () => {
    const [user] = parseMpUserSearch({
      results: {
        Users: [snippet("https://www.mountainproject.com/user/1/a-b", "A &amp; B &#39;<b>Crusher</b>&#39; O&#x27;Neil")],
      },
    });
    expect(user.name).toBe("A & B 'Crusher' O'Neil");
  });

  it("skips duplicates and things that aren't users", () => {
    const one = snippet("https://www.mountainproject.com/user/1/a", "A");
    expect(parseMpUserSearch({ results: { Users: [one, one, "<a href=\"/route/5/x\">X</a>", 7] } })).toHaveLength(1);
  });

  it("reads an empty or unexpected response as no users", () => {
    expect(parseMpUserSearch({ categories: [], results: [] })).toEqual([]);
    expect(parseMpUserSearch({})).toEqual([]);
    expect(parseMpUserSearch(null)).toEqual([]);
    expect(parseMpUserSearch("<!DOCTYPE html>")).toEqual([]);
  });
});
