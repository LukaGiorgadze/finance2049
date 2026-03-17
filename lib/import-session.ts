import type { ImportedGroup } from '@/components/import/types';

export type ImportFileInfo = {
  name: string;
  mimeType: string;
  sizeBytes: number;
};

export type FailedFileInfo = {
  name: string;
  mimeType: string;
  error: string;
};

export type ImportSession = {
  groups: ImportedGroup[];
  fileName: string | null;
  files: ImportFileInfo[];
  failedFiles: FailedFileInfo[];
};

let _session: ImportSession | null = null;

export const importSession = {
  set(data: ImportSession) { _session = data; },
  get(): ImportSession | null { return _session; },
  clear() { _session = null; },
};
