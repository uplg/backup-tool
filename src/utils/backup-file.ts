/** Prefix used by backup-tool for all generated files */
const BKT_PREFIX = "bkt-";

/** Check if a filename is a backup file created by backup-tool */
export function isBackupFile(filename: string): boolean {
  if (!filename.startsWith(BKT_PREFIX)) return false;
  return filename.endsWith(".gz") || filename.endsWith(".tar.gz") || filename.endsWith(".zip");
}
