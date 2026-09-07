import {
  hasMountainProjectHeaders,
  parseMountainProjectCSV,
} from "./mountainProjectImport";
import { replaceAllClimbs } from "./climbs";
import { MP_URL_KEY } from "./backup";
import type { ClimbRecord } from "./climbs";

/** Content types we are willing to read as a tick export. */
const CSV_CONTENT_TYPES = ["text/csv", "text/plain", "application/csv"];

const LEFT_ALONE = "Your saved climbs were left alone.";

/**
 * Decide whether `csvText` may replace the entire climb log, and throw a
 * message the UI can show as-is if it may not.
 *
 * Both import paths run through here, because both end in `replaceAllClimbs`:
 * anything that gets past this function deletes every climb the user has.
 * `sourceNote` is appended to the "not an export" message to say where the bad
 * data came from.
 */
function parseOrRefuse(csvText: string, sourceNote: string): ClimbRecord[] {
  if (!csvText.trim()) {
    throw new Error(`The export was empty. ${LEFT_ALONE}`);
  }
  if (!hasMountainProjectHeaders(csvText)) {
    throw new Error(
      `That wasn't a Mountain Project CSV export — there is no Route or Rating column in it${sourceNote}. ${LEFT_ALONE}`,
    );
  }
  const climbs = parseMountainProjectCSV(csvText);
  if (climbs.length === 0) {
    throw new Error(`No climbs were found in that export. ${LEFT_ALONE}`);
  }
  return climbs;
}

/**
 * Fetch the Mountain Project tick export at `url`, parse it, and replace every
 * stored climb with the result. The URL is only remembered when the whole thing
 * succeeds, so a fetch that fails doubles as validation of what the user typed.
 *
 * Returns the number of climbs imported.
 */
export async function refreshFromMountainProject(url: string): Promise<number> {
  const trimmed = url.trim();
  if (!trimmed) throw new Error("No Mountain Project URL.");

  const response = await fetch(`/api/fetch-mp-csv?url=${encodeURIComponent(trimmed)}`);
  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${response.statusText}`.trim());
  }

  // The content type is a hint, not the verdict. A real export can arrive with
  // a surprising type, so it only sharpens the error message; the header check
  // below is what actually decides.
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  const looksLikeCsv = CSV_CONTENT_TYPES.some((type) => contentType.includes(type));
  const sourceNote = looksLikeCsv
    ? ""
    : ` (the server sent back ${contentType.split(";")[0] || "an unlabelled response"} instead of a CSV)`;

  const climbs = parseOrRefuse(await response.text(), sourceNote);
  await replaceAllClimbs(climbs);
  localStorage.setItem(MP_URL_KEY, trimmed);
  return climbs.length;
}

/**
 * Parse a Mountain Project CSV the user picked off disk and replace every
 * stored climb with it. Returns the number of climbs imported.
 */
export async function importClimbsFromFile(file: File): Promise<number> {
  const climbs = parseOrRefuse(await file.text(), ` in "${file.name}"`);
  await replaceAllClimbs(climbs);
  return climbs.length;
}

/** The tick-export URL saved on this device, or "" if there isn't one. */
export function getMountainProjectUrl(): string {
  return localStorage.getItem(MP_URL_KEY) ?? "";
}

/** Forget the saved tick-export URL. */
export function clearMountainProjectUrl(): void {
  localStorage.removeItem(MP_URL_KEY);
}
