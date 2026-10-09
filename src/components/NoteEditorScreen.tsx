import { useEffect, useMemo, useState } from "react";
import { saveNote, deleteNote, getNotes } from "../lib/notes";
import type { NoteRecord } from "../lib/notes";
import { BackChevronIcon } from "./icons";
import { LeaveGuardSheet } from "./LeaveGuardSheet";
import { useLeaveGuard } from "../hooks/useLeaveGuard";
import { todayDateString } from "../lib/dates";

type Props = {
  onBack: () => void;
  onSaved: () => void;
  initialRecord?: NoteRecord;
  onDeleted?: () => void;
};

// Starter categories suggested as pills before any have been used. Free text,
// so users can still type their own — these just seed the common ones.
const SUGGESTED_CATEGORIES = ["Health", "Recovery", "Training", "Goals", "Resources"];

export function NoteEditorScreen({ onBack, onSaved, initialRecord, onDeleted }: Props) {
  const editing = initialRecord !== undefined;

  const [dateValue, setDateValue] = useState(() => initialRecord?.date ?? todayDateString());
  const [category, setCategory] = useState(() => initialRecord?.category ?? "Health");
  const [text, setText] = useState(() => initialRecord?.text ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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

  // A new note's date and starter category are defaults, so only its text is work.
  const leaveGuard = useLeaveGuard(editing ? hasChanges : trimmedText !== "");

  const handleSave = async () => {
    if (!trimmedText) return;
    setSaving(true);
    try {
      if (editing && initialRecord) {
        const updated: NoteRecord = {
          ...initialRecord,
          date: dateValue,
          text: trimmedText,
          ...(trimmedCategory ? { category: trimmedCategory } : {}),
        };
        if (!trimmedCategory) delete updated.category;
        await saveNote(updated);
      } else {
        const record: NoteRecord = {
          id: crypto.randomUUID(),
          date: dateValue,
          text: trimmedText,
          createdAt: Date.now(),
          ...(trimmedCategory ? { category: trimmedCategory } : {}),
        };
        await saveNote(record);
      }
      leaveGuard.allowLeave();
      onSaved();
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    if (initialRecord) {
      await deleteNote(initialRecord.id).catch(console.error);
      leaveGuard.allowLeave();
      onDeleted?.();
    }
  };

  return (
    <div className="h-full bg-gray-900 flex flex-col">
      <header className="bg-gray-800 px-4 pt-4 pb-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <BackChevronIcon />
        </button>
        <h1 className="text-white font-bold text-lg">
          {editing ? "Edit note" : "New note"}
        </h1>
      </header>

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
            <div className="flex gap-2 overflow-x-auto pl-[5.75rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {categoryOptions.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  aria-pressed={category === c}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${
                    category === c
                      ? "bg-accent-600 text-white border-transparent"
                      : "bg-gray-800 text-gray-400 border-gray-700"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text */}
        <textarea
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={!editing}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="Notes…"
          className="w-full bg-gray-800 text-white rounded-lg px-3 py-2.5 text-sm leading-relaxed placeholder-gray-500 resize-none border border-gray-700 focus:outline-none focus:border-accent-500/60"
        />
      </div>

      {/* Bottom actions */}
      <div className="px-4 pb-6 pt-3 flex flex-col gap-3 shrink-0 border-t border-gray-800">
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-3 rounded-lg font-semibold bg-gray-800 active:bg-gray-700 text-gray-300 text-base"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !trimmedText || !dateValue || !hasChanges}
            className="flex-1 py-3 rounded-lg font-semibold bg-accent-600 active:bg-accent-700 text-white text-base disabled:bg-gray-700 disabled:text-gray-500"
          >
            {saving ? "Saving…" : editing ? "Save changes" : "Save note"}
          </button>
        </div>

        {editing && (
          <button
            onClick={handleDelete}
            className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-colors ${
              confirmDelete ? "bg-red-600 text-white" : "text-red-400/80 active:bg-gray-800"
            }`}
          >
            {confirmDelete ? "Tap again to delete" : "Delete note"}
          </button>
        )}
      </div>
      <LeaveGuardSheet
        guard={leaveGuard}
        lost={editing ? "Your changes to this note" : "The note you've written"}
      />
    </div>
  );
}
