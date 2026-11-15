/**
 * Finding a Mountain Project account without copying its "Export CSV" link.
 *
 * Only the numeric user id matters to Mountain Project: the name segment of a
 * `/user/<id>/<name>/tick-export` URL can be anything. So a profile link, a
 * link shared from the Mountain Project app, or the bare id is enough to build
 * the export URL.
 */

const MP_ORIGIN = "https://www.mountainproject.com";

/** The name segment used when all we have is an id. */
const PLACEHOLDER_SLUG = "user";

export type MpUser = {
  id: string;
  name: string;
  /** Where the account says it is from; often empty. */
  location: string;
  profileUrl: string;
  tickExportUrl: string;
};

function buildTickExportUrl(id: string, slug: string): string {
  return `${MP_ORIGIN}/user/${id}/${slug}/tick-export`;
}

/**
 * Turn what the user typed or pasted into a tick-export URL: a tick-export
 * URL, any Mountain Project `/user/<id>/…` link, or a bare user id. Returns
 * null when it is none of those.
 */
export function tickExportUrlFrom(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return buildTickExportUrl(text, PLACEHOLDER_SLUG);

  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== "mountainproject.com" && !host.endsWith(".mountainproject.com")) return null;

  const match = /^\/user\/(\d+)(?:\/([^/]+))?/.exec(parsed.pathname);
  if (!match) return null;
  const slug = match[2] && match[2] !== "tick-export" ? match[2] : PLACEHOLDER_SLUG;
  return buildTickExportUrl(match[1], slug);
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] !== "#") return ENTITIES[body.toLowerCase()] ?? whole;
    const hex = body[1] === "x" || body[1] === "X";
    const code = parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

function innerText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

/**
 * Read the users out of Mountain Project's search response. Each result is an
 * HTML snippet: a link to `/user/<id>/<name>` wrapping the display name and an
 * optional location. The link may point at a sister site (Hiking Project, MTB
 * Project); accounts are shared across them, so the id is still the one we want.
 *
 * Anything that doesn't look like a user is skipped, and a response in an
 * unexpected shape reads as no users.
 */
export function parseMpUserSearch(body: unknown): MpUser[] {
  const results = (body as { results?: unknown } | null)?.results;
  const snippets = (results as { Users?: unknown } | null | undefined)?.Users;
  if (!Array.isArray(snippets)) return [];

  const users: MpUser[] = [];
  const seen = new Set<string>();
  for (const snippet of snippets) {
    if (typeof snippet !== "string") continue;
    const link = /href="[^"]*?\/user\/(\d+)\/([^/?"#]+)/.exec(snippet);
    if (!link) continue;
    const [, id, slug] = link;
    if (seen.has(id)) continue;

    const divs = [...snippet.matchAll(/<div[^>]*>([\s\S]*?)<\/div>/g)].map((m) => innerText(m[1]));
    const name = divs[0] || slug.replace(/-/g, " ");
    seen.add(id);
    users.push({
      id,
      name,
      location: divs[1] ?? "",
      profileUrl: `${MP_ORIGIN}/user/${id}/${slug}`,
      tickExportUrl: buildTickExportUrl(id, slug),
    });
  }
  return users;
}

/**
 * Search Mountain Project accounts by name. `offset` is how many results to
 * skip, for "show more".
 */
export async function searchMountainProjectUsers(query: string, offset = 0): Promise<MpUser[]> {
  const q = query.trim();
  if (!q) return [];
  const response = await fetch(`/api/search-mp-users?q=${encodeURIComponent(q)}&offset=${offset}`);
  if (!response.ok) {
    throw new Error(`Search failed: ${response.status} ${response.statusText}`.trim());
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("Search failed: Mountain Project sent back something unexpected.");
  }
  return parseMpUserSearch(body);
}
