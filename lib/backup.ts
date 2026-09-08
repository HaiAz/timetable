/**
 * Browser file download / upload for JSON backups.
 * Kept separate from `store.ts` so the storage boundary stays about storage.
 */

/** `lich-day-2026-09-08.json` */
export function backupFilename(prefix = "lich-day"): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${prefix}-${y}-${m}-${d}.json`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Release the object URL once the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download a valid export as a .json file. */
export function downloadBackup(json: string, prefix?: string): void {
  triggerDownload(
    new Blob([json], { type: "application/json" }),
    backupFilename(prefix),
  );
}

/**
 * Download whatever is in storage verbatim, even if unparseable — the last
 * resort before resetting corrupt data.
 */
export function downloadRaw(raw: string, prefix = "loi-du-lieu"): void {
  triggerDownload(new Blob([raw], { type: "text/plain" }), backupFilename(prefix));
}

/** Read a user-picked file as text. */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Không đọc được tệp."));
    reader.readAsText(file);
  });
}
