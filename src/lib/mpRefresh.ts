import { fetchTickExport, parseOrRefuse } from "./mpFetch";
import { replaceAllClimbs } from "./climbs";
import { MP_URL_KEY } from "./backup";
import { tickExportUrlFrom } from "./mpAccount";

const LEFT_ALONE = "Your saved climbs were left alone.";

/**
 * Fetch the Mountain Project tick export for `url`, parse it, and replace every
 * stored climb with the result. `url` may be the export URL itself, any link to
 * the user's Mountain Project profile, or their bare user id. The export URL is
 * only remembered when the whole thing succeeds, so a fetch that fails doubles
 * as validation of what the user typed.
 *
 * Returns the number of climbs imported.
 */
export async function refreshFromMountainProject(url: string): Promise<number> {
  if (!url.trim()) throw new Error("No Mountain Project URL.");
  const exportUrl = tickExportUrlFrom(url);
  if (!exportUrl) {
    throw new Error(
      `That isn't a Mountain Project profile link or user ID. ${LEFT_ALONE}`,
    );
  }

  const climbs = await fetchTickExport(exportUrl, LEFT_ALONE);
  await replaceAllClimbs(climbs);
  localStorage.setItem(MP_URL_KEY, exportUrl);
  return climbs.length;
}

/**
 * Parse a Mountain Project CSV the user picked off disk and replace every
 * stored climb with it. Returns the number of climbs imported.
 */
export async function importClimbsFromFile(file: File): Promise<number> {
  const climbs = parseOrRefuse(await file.text(), ` in "${file.name}"`, LEFT_ALONE);
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
