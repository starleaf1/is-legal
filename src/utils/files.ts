// Upload rules allow these types only (see storage.rules).
export const ACCEPTED_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
}

export const ACCEPT_ATTRIBUTE = '.pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown'

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

// Browsers often report no type (or a wrong one) for .md files, so derive
// the content type from the extension.
export const contentTypeFor = (fileName: string): string | null => {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''
  return ACCEPTED_TYPES[extension] ?? null
}

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
