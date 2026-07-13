import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import postcss from 'postcss'

const rootDir = process.cwd()
const writeChanges = process.argv.includes('--write')
const stylesheetOrder = [
  'src/styles/theme-tokens.css',
  'src/index.css',
  'src/styles/features/dark-mode.css',
  'src/styles/features/batch-adjust.css',
  'src/styles/features/build-menu.css',
  'src/styles/features/editor-parameters.css',
  'src/styles/features/credits.css',
  'src/styles/features/header.css',
  'src/styles/features/project-changes.css',
  'src/styles/features/sidebar.css',
  'src/styles/features/main-menu.css',
  'src/styles/features/accessibility.css',
  'src/styles/features/preset-gallery.css',
  'src/styles/features/editor-context.css',
  'src/components/ui/ui.css',
]

const documents = stylesheetOrder.map((relativePath) => {
  const absolutePath = path.join(rootDir, relativePath)
  return {
    relativePath,
    absolutePath,
    root: postcss.parse(fs.readFileSync(absolutePath, 'utf8'), { from: absolutePath }),
    removed: 0,
  }
})

function atRuleContext(node) {
  const context = []
  let parent = node.parent

  while (parent && parent.type !== 'root') {
    if (parent.type === 'atrule') context.push(`${parent.name}:${parent.params}`)
    parent = parent.parent
  }

  return context.reverse().join('>')
}

const declarations = []
for (const document of documents) {
  document.root.walkRules((rule) => {
    const context = atRuleContext(rule)
    rule.walkDecls((declaration) => {
      declarations.push({
        document,
        declaration,
        key: [
          context,
          rule.selector,
          declaration.prop.toLowerCase(),
          declaration.value.trim(),
          declaration.important ? 'important' : 'normal',
        ].join('\u0000'),
      })
    })
  })
}

const tokenDocument = documents[0]
const canonicalTokenKeys = new Set(
  declarations
    .filter((entry) => entry.document === tokenDocument)
    .map((entry) => entry.key),
)
const seen = new Set()
for (let index = declarations.length - 1; index >= 0; index -= 1) {
  const entry = declarations[index]
  if (entry.document === tokenDocument) continue

  if (canonicalTokenKeys.has(entry.key)) {
    entry.declaration.remove()
    entry.document.removed += 1
    continue
  }

  if (!seen.has(entry.key)) {
    seen.add(entry.key)
    continue
  }

  entry.declaration.remove()
  entry.document.removed += 1
}

for (const document of documents) {
  document.root.walkRules((rule) => {
    if (!rule.nodes?.some((node) => node.type === 'decl' || node.type === 'atrule')) rule.remove()
  })

  if (writeChanges && document.removed > 0) {
    fs.writeFileSync(document.absolutePath, document.root.toString())
  }
}

const totalRemoved = documents.reduce((sum, document) => sum + document.removed, 0)
console.log(`${writeChanges ? 'Removed' : 'Found'} ${totalRemoved} exact duplicate declarations.`)
for (const document of documents.filter((entry) => entry.removed > 0)) {
  console.log(`- ${document.relativePath}: ${document.removed}`)
}

if (!writeChanges && totalRemoved > 0) {
  console.log('Run npm run consolidate-css to apply this cleanup.')
}
