import { getDB } from "./history";

// ─── Types ───────────────────────────────────────────────────────────────────

export type NoteRecord = {
  id: string;
  date: string; // YYYY-MM-DD
  text: string;
  category?: string;
  createdAt: number;
};

// ─── CRUD ────────────────────────────────────────────────────────────────────

const STORE = "notes";

export async function addNote(record: NoteRecord): Promise<void> {
  const db = await getDB();
  await db.put(STORE, record);
}

/** Returns all notes sorted newest-first by date, then by createdAt. */
export async function getNotes(): Promise<NoteRecord[]> {
  const db = await getDB();
  const all = (await db.getAll(STORE)) as NoteRecord[];
  return all.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.createdAt - a.createdAt;
  });
}

export async function updateNote(record: NoteRecord): Promise<void> {
  const db = await getDB();
  await db.put(STORE, record);
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
}

export async function replaceAllNotes(records: NoteRecord[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE, "readwrite");
  await tx.store.clear();
  for (const r of records) {
    await tx.store.put(r);
  }
  await tx.done;
}
