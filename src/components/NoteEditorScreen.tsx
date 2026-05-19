import { useEffect, useMemo, useState } from "react";
import { addNote, updateNote, deleteNote, getNotes } from "../lib/notes";
import type { NoteRecord } from "../lib/notes";
import { BackChevronIcon } from "./icons";

type Props = {
  onBack: () => void;
  onSaved: () => void;
  initialRecord?: NoteRecord;
  onDeleted?: () => void;
};

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function NoteEditorScreen({ onBack, onSaved, initialRecord, onDeleted }: Props) {
  const editing = initialRecord !== undefined;

  const [dateValue, setDateValue] = useState(() => initialRecord?.date ?? todayString());
  const [category, setCategory] = useState(() => initialRecord?.category ?? "injury");
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

  const hasChanges = useMemo(() => {
    if (!editing || !initialRecord) return true;
    if (dateValue !== initialRecord.date) return true;
    if ((trimmedCategory || undefined) !== initialRecord.category) return true;
    if (trimmedText !== initialRecord.text) return true;
    return false;
  }, [editing, initialRecord, dateValue, trimmedCategory, trimmedText]);

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
        await updateNote(updated);
      } else {
        const record: NoteRecord = {
          id: crypto.randomUUID(),
          date: dateValue,
          text: trimmedText,
          createdAt: Date.now(),
          ...(trimmedCategory ? { category: trimmedCategory } : {}),
        };
        await addNote(record);
      }
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
      onDeleted?.();
    }
  };

  return (
    <div className="h-dvh bg-gray-900 flex flex-col">
      <header className="bg-gray-800 px-4 pt-4 pb-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors p-1 -ml-1"
          aria-label="Back"
        >
          <BackChevronIcon />
        </button>
        <h1 className="text-white font-bold text-lg">
          {editing ? "Edit Note" : "New Note"}
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
            className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:outline-none focus:border-gray-500"
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
              placeholder="e.g. injury, training"
              className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 text-sm placeholder-gray-600 border border-gray-700 focus:outline-none focus:border-gray-500"
            />
            <datalist id="note-categories">
              {existingCategories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          {existingCategories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pl-[5.75rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {existingCategories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                    category === c
                      ? "bg-purple-600 text-white"
                      : "bg-gray-800 text-gray-400 border border-gray-700"
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
          className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 text-sm placeholder-gray-600 resize-none border border-gray-700 focus:outline-none focus:border-gray-500"
        />
      </div>

      {/* Bottom actions */}
      <div className="px-4 pb-6 pt-3 flex flex-col gap-3 shrink-0 border-t border-gray-800">
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-3 rounded-xl font-semibold bg-gray-800 text-gray-400 text-base"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !trimmedText || !dateValue || !hasChanges}
            className="flex-1 py-3 rounded-xl font-semibold bg-purple-600 text-white text-base disabled:opacity-50"
          >
            {saving ? "Saving…" : editing ? "Save Changes" : "Save Note"}
          </button>
        </div>

        {editing && (
          <button
            onClick={handleDelete}
            className={`w-full py-2.5 rounded-xl font-semibold text-base transition-colors ${
              confirmDelete ? "bg-red-600 text-white" : "bg-gray-800 text-gray-500"
            }`}
          >
            {confirmDelete ? "Tap again to delete" : "Delete Note"}
          </button>
        )}
      </div>
    </div>
  );
}
