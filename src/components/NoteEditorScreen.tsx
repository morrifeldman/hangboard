import { useEffect, useMemo, useState } from "react";
import { saveNote, deleteNote, getNotes } from "../lib/notes";
import type { NoteRecord } from "../lib/notes";
import { LeaveGuardSheet } from "./LeaveGuardSheet";
import { ScreenHeader } from "./ScreenHeader";
import { EditorFooter } from "./EditorFooter";
import { useEditor } from "../hooks/useEditor";
import { Pill, PillRow } from "./ui";
import { todayDateString } from "../lib/dates";

type Props = {
  onBack: () => void;
  /** After a successful save or delete. */
  onDone: () => void;
  initialRecord?: NoteRecord;
};

// Starter categories suggested as pills before any have been used. Free text,
// so users can still type their own — these just seed the common ones.
const SUGGESTED_CATEGORIES = ["Health", "Recovery", "Training", "Goals", "Resources"];

export function NoteEditorScreen({ onBack, onDone, initialRecord }: Props) {
  const editing = initialRecord !== undefined;

  const [dateValue, setDateValue] = useState(() => initialRecord?.date ?? todayDateString());
  const [category, setCategory] = useState(() => initialRecord?.category ?? "Health");
  const [text, setText] = useState(() => initialRecord?.text ?? "");
  const [existingCategories, setExistingCategories] = useState<string[]>([]);

  useEffect(() => {
    getNotes().then((notes) => {
      const cats = [...new Set(notes.map((n) => n.category).filter((c): c is string => !!c))];
      setExistingCategories(cats);
    }).catch(console.error);
  }, []);

  const trimmedText = text.trim();
  const trimmedCategory = category.trim();

  // Suggested starters first, then any other categories the user has used.
  // "injury" is retired in favour of "Health" — don't resurface it as a pill,
  // even if legacy notes still carry it.
  const categoryOptions = useMemo(() => {
    const seen = new Set(SUGGESTED_CATEGORIES.map((c) => c.toLowerCase()));
    const extra = existingCategories.filter(
      (c) => !seen.has(c.toLowerCase()) && c.toLowerCase() !== "injury",
    );
    return [...SUGGESTED_CATEGORIES, ...extra];
  }, [existingCategories]);

  const hasChanges = useMemo(() => {
    if (!editing || !initialRecord) return true;
    if (dateValue !== initialRecord.date) return true;
    if ((trimmedCategory || undefined) !== initialRecord.category) return true;
    if (trimmedText !== initialRecord.text) return true;
    return false;
  }, [editing, initialRecord, dateValue, trimmedCategory, trimmedText]);

  const editor = useEditor({
    // A new note's date and starter category are defaults, so only its text is work.
    dirty: editing ? hasChanges : trimmedText !== "",
    onSave: async () => {
      const record: NoteRecord = {
        ...(initialRecord ?? { id: crypto.randomUUID(), createdAt: Date.now() }),
        date: dateValue,
        text: trimmedText,
      };
      if (trimmedCategory) record.category = trimmedCategory;
      else delete record.category;
      await saveNote(record);
    },
    onDelete: initialRecord ? () => deleteNote(initialRecord.id) : undefined,
    onDone,
  });

  return (
    <div className="h-full bg-gray-900 flex flex-col">
      <ScreenHeader title={editing ? "Edit note" : "New note"} onBack={onBack} />

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {/* Date */}
        <div className="flex items-center gap-3">
          <label className="text-gray-400 text-sm w-20 flex-shrink-0">Date</label>
          <input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="flex-1 min-w-0 h-10 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 [color-scheme:dark] focus:outline-none focus:border-accent-500/60"
          />
        </div>

        {/* Category */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <label className="text-gray-400 text-sm w-20 flex-shrink-0">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              list="note-categories"
              placeholder="e.g. Health, Training"
              className="flex-1 min-w-0 h-10 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm placeholder-gray-500 border border-gray-700 focus:outline-none focus:border-accent-500/60"
            />
            <datalist id="note-categories">
              {categoryOptions.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          {categoryOptions.length > 0 && (
            <PillRow className="pl-[5.75rem]">
              {categoryOptions.map((c) => (
                <Pill key={c} size="sm" selected={category === c} onClick={() => setCategory(c)}>
                  {c}
                </Pill>
              ))}
            </PillRow>
          )}
        </div>

        {/* Text */}
        <textarea
          autoFocus={!editing}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="Notes…"
          className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 text-sm leading-relaxed placeholder-gray-500 resize-none border border-gray-700 focus:outline-none focus:border-accent-500/60"
        />
      </div>

      <EditorFooter
        editor={editor}
        saveLabel={editing ? "Save changes" : "Save note"}
        saveDisabled={!trimmedText || !dateValue || !hasChanges}
        deleteLabel="Delete note"
      />
      <LeaveGuardSheet
        guard={editor.guard}
        lost={editing ? "Your changes to this note" : "The note you've written"}
      />
    </div>
  );
}
