import DOMPurify from 'dompurify'
import { marked } from 'marked'

const REF_MARKER = /\[(\d+(?:\s*,\s*\d+)*)\]/g

/**
 * Renders model-written markdown to sanitized HTML, turning citation markers
 * like [2] or [1, 3] into clickable superscript links carrying data-ref.
 */
export const renderMarkdown = (markdown: string): string => {
  const html = marked.parse(markdown, { async: false, gfm: true, breaks: false })
  const withRefs = html.replace(REF_MARKER, (_match, list: string) => {
    const links = list.split(',').map(n => n.trim())
      .map(ref => `<a href="#" class="cite-ref" data-ref="${ref}">${ref}</a>`)
    return `<sup class="cite">[${links.join(', ')}]</sup>`
  })
  return DOMPurify.sanitize(withRefs)
}

/** Plain text with citation markers removed, for compact displays. */
export const stripRefs = (text: string) => text.replace(/\s?\[(\d+(?:\s*,\s*\d+)*)\]/g, '')
