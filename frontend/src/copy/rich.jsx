// Minimal emphasis for copy strings: **strong**, *em*, `code` become the
// matching elements; everything else renders literally. This keeps markup
// out of the components AND out of raw HTML — the copy file stays plain
// text that Stew can edit with emphasis intact.

import { Fragment, createElement } from 'react'

const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g

export function rich(text) {
  const parts = []
  let last = 0
  let key = 0
  for (const match of text.matchAll(TOKEN)) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const token = match[0]
    if (token.startsWith('**')) parts.push(createElement('strong', { key: key++ }, token.slice(2, -2)))
    else if (token.startsWith('`')) parts.push(createElement('code', { key: key++ }, token.slice(1, -1)))
    else parts.push(createElement('em', { key: key++ }, token.slice(1, -1)))
    last = match.index + token.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return createElement(Fragment, null, ...parts)
}
