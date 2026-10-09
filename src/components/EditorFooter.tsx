import type { Editor } from "../hooks/useEditor";

/**
 * The bottom of every editor: Save, then (when editing) a two-tap Delete, and
 * any error from the last attempt.
 */
export function EditorFooter({
  editor,
  saveLabel,
  saveDisabled = false,
  deleteLabel,
  deleteNote,
}: {
  editor: Editor;
  saveLabel: string;
  saveDisabled?: boolean;
  deleteLabel?: string;
  /** A line under the delete button, e.g. what deleting keeps. */
  deleteNote?: string;
}) {
  const { busy, error, save, remove } = editor;
  return (
    <div className="px-4 pb-6 pt-3 flex flex-col gap-3 shrink-0 border-t border-gray-800">
      {error && (
        <p role="alert" className="text-sm text-red-400 text-center">
          {error}
        </p>
      )}
      <button
        onClick={save}
        disabled={busy || saveDisabled}
        className="w-full h-12 rounded-xl font-semibold bg-accent-500 active:bg-accent-400 text-gray-900 text-base transition-colors disabled:bg-gray-700 disabled:text-gray-500"
      >
        {busy ? "Saving…" : saveLabel}
      </button>
      {remove && deleteLabel && (
        <button
          onClick={remove.tap}
          disabled={busy}
          className={`w-full h-11 rounded-xl font-semibold text-base transition-colors disabled:bg-gray-700 disabled:text-gray-500 ${
            remove.armed ? "bg-red-600 text-white" : "bg-gray-800 text-red-400"
          }`}
        >
          {remove.armed ? "Tap again to delete" : deleteLabel}
        </button>
      )}
      {remove && deleteNote && <p className="text-center text-xs text-gray-500">{deleteNote}</p>}
    </div>
  );
}
