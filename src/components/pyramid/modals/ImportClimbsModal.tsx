import { useRef, useState } from "react";
import { importMountainProjectCSV } from "../../../lib/mountainProjectImport";
import type { ClimbRecord } from "../../../lib/climbs";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (climbs: ClimbRecord[], replaceAll: boolean) => void;
};

const INPUT = "w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-500";

export function ImportClimbsModal({ isOpen, onClose, onImportComplete }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [replaceAllData, setReplaceAllData] = useState(true);
  const [importMethod, setImportMethod] = useState<"url" | "file">("url");
  const [csvUrl, setCsvUrl] = useState(() => localStorage.getItem("mountainProjectUrl") || "");
  const [status, setStatus] = useState("");

  if (!isOpen) return null;

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "text/csv") {
      try {
        setStatus("Reading CSV...");
        const climbs = await importMountainProjectCSV(file);
        onImportComplete(climbs, replaceAllData);
        onClose();
        setStatus("");
      } catch (error) {
        setStatus(`Error: ${(error as Error).message}`);
      }
    } else {
      setStatus("Please select a valid CSV file");
    }
  };

  const handleUrlImport = async () => {
    if (!csvUrl.trim()) {
      setStatus("Please enter a URL");
      return;
    }
    onClose();
    try {
      const apiUrl = `/api/fetch-mp-csv?url=${encodeURIComponent(csvUrl)}`;
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`Failed: ${response.statusText}`);

      const csvText = await response.text();
      const blob = new Blob([csvText], { type: "text/csv" });
      const file = new File([blob], "mp-export.csv", { type: "text/csv" });
      const climbs = await importMountainProjectCSV(file);

      localStorage.setItem("mountainProjectUrl", csvUrl);
      onImportComplete(climbs, replaceAllData);
    } catch (error) {
      console.error("Import error:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-white">Import Mountain Project CSV</h3>

          <div className="space-y-4">
            <div className="flex space-x-4">
              <label className="flex items-center text-gray-300">
                <input
                  type="radio"
                  name="importMethod"
                  value="url"
                  checked={importMethod === "url"}
                  onChange={() => setImportMethod("url")}
                  className="mr-2"
                />
                Import from URL
              </label>
              <label className="flex items-center text-gray-300">
                <input
                  type="radio"
                  name="importMethod"
                  value="file"
                  checked={importMethod === "file"}
                  onChange={() => setImportMethod("file")}
                  className="mr-2"
                />
                Upload CSV
              </label>
            </div>

            {importMethod === "url" ? (
              <>
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                  <h4 className="font-medium text-green-300 mb-1 text-sm">Steps:</h4>
                  <ol className="text-sm text-green-400 space-y-0.5">
                    <li>1. Mountain Project &rarr; Profile &rarr; Ticks</li>
                    <li>2. Make ticks public</li>
                    <li>3. Copy tick export URL</li>
                    <li>4. Paste below</li>
                  </ol>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Tick Export URL
                  </label>
                  <input
                    type="url"
                    value={csvUrl}
                    onChange={(e) => setCsvUrl(e.target.value)}
                    placeholder="https://www.mountainproject.com/user/.../tick-export"
                    className={INPUT + " text-sm"}
                  />
                  <button
                    onClick={handleUrlImport}
                    disabled={!csvUrl.trim()}
                    className="w-full mt-2 bg-green-600 text-white py-2 px-4 rounded-xl hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                  >
                    Import from URL
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <h4 className="font-medium text-blue-300 mb-1 text-sm">Steps:</h4>
                  <ol className="text-sm text-blue-400 space-y-0.5">
                    <li>1. Mountain Project &rarr; Profile &rarr; Ticks</li>
                    <li>2. Export as CSV</li>
                    <li>3. Select file below</li>
                  </ol>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">CSV File</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-700 file:text-gray-300 hover:file:bg-gray-600 file:cursor-pointer cursor-pointer border-2 border-dashed border-gray-600 rounded-lg p-3"
                  />
                </div>
              </>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={replaceAllData}
                onChange={(e) => setReplaceAllData(e.target.checked)}
                className="w-4 h-4 text-green-600 border-gray-600 rounded focus:ring-green-500"
              />
              <span className="text-gray-300">Replace all existing climb data</span>
            </label>

            {status && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  status.includes("Error")
                    ? "bg-red-500/10 text-red-400 border border-red-500/30"
                    : "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                }`}
              >
                {status}
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                onClose();
                setStatus("");
              }}
              className="flex-1 bg-gray-700 text-gray-300 py-2 px-4 rounded-xl hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
