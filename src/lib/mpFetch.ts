import {
  hasMountainProjectHeaders,
  parseMountainProjectCSV,
} from "./mountainProjectImport";
import type { ClimbRecord } from "./climbs";

/** Content types we are willing to read as a tick export. */
const CSV_CONTENT_TYPES = ["text/csv", "text/plain", "application/csv"];

/**
 * Decide whether `csvText` is a usable tick export, and throw a message the UI
 * can show as-is if it is not.
 *
 * Every import path runs through here, because each ends in replacing a whole
 * set of climbs: anything that gets past this function deletes what was there.
 * `sourceNote` is appended to the "not an export" message to say where the bad
 * data came from; `kept` closes every message by saying nothing was changed.
 */
export function parseOrRefuse(csvText: string, sourceNote: string, kept: string): ClimbRecord[] {
  if (!csvText.trim()) {
    throw new Error(`The export was empty. ${kept}`);
  }
  if (!hasMountainProjectHeaders(csvText)) {
    throw new Error(
      `That wasn't a Mountain Project CSV export — there is no Route or Rating column in it${sourceNote}. ${kept}`,
    );
  }
  const climbs = parseMountainProjectCSV(csvText);
  if (climbs.length === 0) {
    throw new Error(`No climbs were found in that export. ${kept}`);
  }
  return climbs;
}

/** Fetch and parse the tick export at `exportUrl`. Throws rather than return nothing. */
export async function fetchTickExport(exportUrl: string, kept: string): Promise<ClimbRecord[]> {
  const response = await fetch(`/api/fetch-mp-csv?url=${encodeURIComponent(exportUrl)}`);
  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${response.statusText}`.trim());
  }

  // The content type is a hint, not the verdict. A real export can arrive with
  // a surprising type, so it only sharpens the error message; the header check
  // is what actually decides.
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  const looksLikeCsv = CSV_CONTENT_TYPES.some((type) => contentType.includes(type));
  const sourceNote = looksLikeCsv
    ? ""
    : ` (the server sent back ${contentType.split(";")[0] || "an unlabelled response"} instead of a CSV)`;

  return parseOrRefuse(await response.text(), sourceNote, kept);
}
