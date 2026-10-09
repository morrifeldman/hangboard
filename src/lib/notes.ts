import { recordStore } from "./db";

// ─── Types ───────────────────────────────────────────────────────────────────

export type NoteRecord = {
  id: string;
  date: string; // YYYY-MM-DD
  text: string;
  category?: string;
  createdAt: number;
};

// ─── CRUD ────────────────────────────────────────────────────────────────────

const notes = recordStore<NoteRecord>("notes");

/** Insert or replace a note. */
export const saveNote = notes.put;
export const deleteNote = notes.remove;
/** One note by id, or undefined once it has been deleted. */
export const getNote = notes.get;

/** Returns all notes sorted newest-first by date, then by createdAt. */
export async function getNotes(): Promise<NoteRecord[]> {
  return (await notes.all()).sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.createdAt - a.createdAt;
  });
}
