/** Check if a filename is a backup file we should manage */
export function isBackupFile(filename: string): boolean {
  return filename.endsWith(".gz") || filename.endsWith(".tar.gz") || filename.endsWith(".zip");
}
