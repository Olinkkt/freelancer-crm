import fs from 'fs'
import path from 'path'
import { SHORTCUTS } from '../lib/shortcuts/registry'
import { renderShortcutsMarkdown } from '../lib/shortcuts/readme'

const README_PATH = path.resolve(process.cwd(), 'README.md')

export function syncShortcutsReadme(): void {
  const content = fs.readFileSync(README_PATH, 'utf-8')
  const generated = renderShortcutsMarkdown(SHORTCUTS)

  const startMarker = '<!-- shortcuts:start -->'
  const endMarker = '<!-- shortcuts:end -->'

  let newContent = content

  if (content.includes(startMarker) && content.includes(endMarker)) {
    const startIndex = content.indexOf(startMarker) + startMarker.length
    const endIndex = content.indexOf(endMarker)
    newContent =
      content.slice(0, startIndex) +
      '\n\n' +
      generated +
      '\n\n' +
      content.slice(endIndex)
  } else {
    // Replace the legacy cheat sheet table under ## ⌨️ Keyboard Velocity Cheat Sheet
    const heading = '## ⌨️ Keyboard Velocity Cheat Sheet'
    const headingIndex = content.indexOf(heading)
    if (headingIndex === -1) {
      throw new Error(`Could not find heading: "${heading}" in README.md`)
    }

    // Find the next section divider "---" or "## 🚀 Quick Start"
    const nextSectionIndex = content.indexOf('\n---\n', headingIndex)
    if (nextSectionIndex === -1) {
      throw new Error('Could not find section divider after keyboard cheat sheet')
    }

    const before = content.slice(0, headingIndex + heading.length)
    const after = content.slice(nextSectionIndex)
    newContent = `${before}\n\n${startMarker}\n\n${generated}\n\n${endMarker}\n${after}`
  }

  fs.writeFileSync(README_PATH, newContent, 'utf-8')
  console.log('Successfully synced shortcuts table in README.md')
}

if (process.argv[1]?.endsWith('sync-shortcuts-readme.ts')) {
  syncShortcutsReadme()
}
