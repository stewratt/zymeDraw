// The single source of truth for user-facing copy. The strings live in
// uiText.json — edit them there, or through the copy editor at
// http://localhost:5174/copy-editor while `npm run dev` runs. Vite
// hot-reloads on save, so wording changes show up in the app live.
//
// This module is pure data + one string helper — no React — so deck.js
// (the pure reducer) can import it safely. Copy that carries emphasis
// (**strong**, *em*, `code`) renders through rich() in rich.jsx.

import uiText from './uiText.json'

export const UI = uiText

// "{count} card{plural} remain" + { count: 3, plural: 's' } → "3 cards remain".
// Unknown tokens stay literal so a typo in the copy file is visible, not blank.
export function fmt(template, vars = {}) {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match))
}
