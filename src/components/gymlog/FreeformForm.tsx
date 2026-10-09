import type { FreeformSection } from "../../lib/history";
import { FIELD_CLS } from "./styles";

type Props = {
  title: string;
  sections: FreeformSection[];
  onTitleChange: (title: string) => void;
  onSectionsChange: (sections: FreeformSection[]) => void;
  /** Past keys and section names, offered as datalist suggestions. */
  keys: string[];
  sectionNames: string[];
  /** Offer "Use last freeform" (a new log with an earlier one to copy from). */
  canUseLast: boolean;
  onUseLast: () => void;
};

const SMALL_INPUT =
  "bg-gray-700 text-white rounded-lg px-3 py-1.5 text-sm placeholder-gray-500 border border-gray-600 focus:outline-none focus:border-accent-500";

export function FreeformForm({
  title,
  sections,
  onTitleChange,
  onSectionsChange,
  keys,
  sectionNames,
  canUseLast,
  onUseLast,
}: Props) {
  const patchSection = (sIdx: number, fn: (sec: FreeformSection) => FreeformSection) =>
    onSectionsChange(sections.map((sec, i) => (i === sIdx ? fn(sec) : sec)));
  const setEntry = (sIdx: number, eIdx: number, patch: Partial<{ key: string; value: string }>) =>
    patchSection(sIdx, (sec) => ({
      ...sec,
      entries: sec.entries.map((e, j) => (j === eIdx ? { ...e, ...patch } : e)),
    }));

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Title (required)"
        className={`w-full placeholder-gray-500 ${FIELD_CLS}`}
      />
      {canUseLast && (
        <button
          type="button"
          onClick={onUseLast}
          className="self-start text-sm font-medium text-accent-400 hover:text-accent-300 py-1.5"
        >
          Use last freeform
        </button>
      )}
      {sections.map((sec, sIdx) => (
        <div key={sIdx} className="bg-gray-800 rounded-2xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              list="freeform-section-names"
              value={sec.name}
              onChange={(e) => patchSection(sIdx, (s) => ({ ...s, name: e.target.value }))}
              placeholder="Section name (optional)"
              className={`flex-1 ${SMALL_INPUT}`}
            />
            {sections.length > 1 && (
              <button
                type="button"
                onClick={() => onSectionsChange(sections.filter((_, i) => i !== sIdx))}
                aria-label="Remove section"
                className="text-gray-500 hover:text-red-400 text-xl leading-none w-7 h-7 flex items-center justify-center"
              >
                ×
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {sec.entries.map((entry, eIdx) => (
              <div key={eIdx} className="flex items-center gap-2">
                <input
                  type="text"
                  list="freeform-keys"
                  value={entry.key}
                  onChange={(e) => setEntry(sIdx, eIdx, { key: e.target.value })}
                  placeholder="key"
                  className={`flex-1 min-w-0 ${SMALL_INPUT}`}
                />
                <input
                  type="text"
                  value={entry.value}
                  onChange={(e) => setEntry(sIdx, eIdx, { value: e.target.value })}
                  placeholder="value"
                  className={`flex-1 min-w-0 ${SMALL_INPUT}`}
                />
                <button
                  type="button"
                  onClick={() =>
                    patchSection(sIdx, (s) => ({ ...s, entries: s.entries.filter((_, j) => j !== eIdx) }))
                  }
                  aria-label="Remove entry"
                  className="text-gray-500 hover:text-red-400 text-xl leading-none w-7 h-7 flex items-center justify-center shrink-0"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                patchSection(sIdx, (s) => ({ ...s, entries: [...s.entries, { key: "", value: "" }] }))
              }
              className="self-start text-xs font-semibold text-gray-400 hover:text-white px-3 py-1.5"
            >
              + Add entry
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onSectionsChange([...sections, { name: "", entries: [{ key: "", value: "" }] }])}
        className="self-start text-xs font-semibold text-gray-400 hover:text-white px-3 py-1.5 rounded-full border border-gray-700 bg-gray-800"
      >
        + Add section
      </button>
      <datalist id="freeform-keys">
        {keys.map((k) => <option key={k} value={k} />)}
      </datalist>
      <datalist id="freeform-section-names">
        {sectionNames.map((n) => <option key={n} value={n} />)}
      </datalist>
    </div>
  );
}
