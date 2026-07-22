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
  'src/styles/features/clone-creator.css',
  'src/styles/features/build-menu.css',
  'src/styles/features/editor-parameters.css',
  'src/styles/features/parameter-guidance.css',
  'src/styles/features/credits.css',
  'src/styles/features/header.css',
  'src/styles/features/project-changes.css',
  'src/styles/features/sidebar.css',
  'src/styles/features/main-menu.css',
  'src/styles/features/accessibility.css',
  'src/styles/features/preset-gallery.css',
  'src/styles/features/editor-context.css',
  'src/styles/features/editor-workbench.css',
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

function collectSourceFiles(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git', 'test-results', 'playwright-report'].includes(entry.name)) continue
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) collectSourceFiles(entryPath, output)
    else if (/\.(?:js|jsx|ts|tsx|html)$/.test(entry.name)) output.push(entryPath)
  }
  return output
}

const applicationSource = [
  ...collectSourceFiles(path.join(rootDir, 'src')),
  path.join(rootDir, 'index.html'),
]
  .filter((sourcePath) => fs.existsSync(sourcePath))
  .map((sourcePath) => fs.readFileSync(sourcePath, 'utf8'))
  .join('\n')

// Feature ownership migrations remove order-sensitive legacy rules once their
// canonical stylesheet is loaded. Keep this list narrow and feature-scoped.
const legacyOwnershipMigrations = [
  {
    document: 'src/index.css',
    selectors: [
      '.editor-unit-header', '.editor-unit-identity', '.unit-dossier-',
      '.editor-unit-actions', '.unit-state-', '.unit-action-controls',
      '.unit-disable-control', '.reset-unit-btn', '.unit-context-',
      '.unit-profile-', '.unit-efficiency-', '.unit-weapon-', '.unit-slot-',
      '.unit-trajectory-', '.clone-identity-',
    ],
  },
  {
    document: 'src/index.css',
    selectors: [
      '.stat-card-default-pill',
      '.clone-creator-',
      '.designer-page',
      '.preset-gallery-page',
      '.weapon-swap-',
      '.editor-workspace',
      '.editor-scroll-area',
      '.editor-section-tabs',
      '.unit-source-badge',
      '.clone-badge',
      '[data-theme="dark"] .weapon-substitution',
      // Weapon Laboratory is deliberately inaccessible. Its three historical
      // styling generations should not remain in the production stylesheet.
      '.weapon-lab-',
      '.weapon-library-',
      '.weapon-ceg-',
      '.weapon-toggle-track',
      ':root',
    ],
  },
  {
    document: 'src/styles/features/editor-context.css',
    selectors: ['.editor-section-tabs'],
  },
]

for (const migration of legacyOwnershipMigrations) {
  const document = documents.find((entry) => entry.relativePath === migration.document)
  if (!document) continue
  document.root.walkRules((rule) => {
    const selectors = rule.selectors || [rule.selector]
    const retainedSelectors = selectors.filter(
      (selector) => !migration.selectors.some((ownedSelector) => selector.includes(ownedSelector)),
    )
    const removedSelectors = selectors.length - retainedSelectors.length
    if (removedSelectors === 0) return

    document.removed += removedSelectors
    if (retainedSelectors.length === 0) {
      rule.remove()
      return
    }

    rule.selectors = retainedSelectors
  })
}

// Remove legacy rules whose class names no longer exist anywhere in the app.
// Feature stylesheets are excluded because lazy features may own intentionally
// dormant states; this is only safe for the historical index compatibility layer.
const legacyDocument = documents.find((entry) => entry.relativePath === 'src/index.css')
legacyDocument?.root.walkRules((rule) => {
  const selectors = rule.selectors || [rule.selector]
  const isDead = selectors.every((selector) => {
    const classNames = [...selector.matchAll(/\.([_a-zA-Z]+[\w-]*)/g)].map((match) => match[1])
    return classNames.length > 0 && classNames.some((className) => !applicationSource.includes(className))
  })
  if (!isDead) return
  rule.remove()
  legacyDocument.removed += 1
})

legacyDocument?.root.walkAtRules('keyframes', (atRule) => {
  let references = 0
  legacyDocument.root.walkDecls(/^animation(?:-name)?$/, (declaration) => {
    if (declaration.value.includes(atRule.params)) references += 1
  })
  if (references > 0) return
  atRule.remove()
  legacyDocument.removed += 1
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

// A later declaration with the same selector, property, and at-rule context
// always wins inside one stylesheet. Removing the superseded declaration is
// cascade-safe and collapses the historical "final override" layers without
// attempting risky shorthand/longhand inference.
for (const document of documents) {
  const documentDeclarations = []
  document.root.walkRules((rule) => {
    const context = atRuleContext(rule)
    rule.walkDecls((declaration) => {
      documentDeclarations.push({
        declaration,
        key: [context, rule.selector, declaration.prop.toLowerCase()].join('\u0000'),
      })
    })
  })

  const laterDeclarations = new Map()
  for (let index = documentDeclarations.length - 1; index >= 0; index -= 1) {
    const entry = documentDeclarations[index]
    const later = laterDeclarations.get(entry.key)
    const isSuperseded = later && (!entry.declaration.important || later.important)

    if (isSuperseded) {
      entry.declaration.remove()
      document.removed += 1
      continue
    }

    if (!later || (entry.declaration.important && !later.important)) {
      laterDeclarations.set(entry.key, entry.declaration)
    }
  }
}

// Grouped rules can also be fully superseded when every selector has a later
// declaration for the same property. This pass intentionally removes only
// declarations that are dead for every selector in the group.
for (const document of documents) {
  const documentDeclarations = []
  document.root.walkRules((rule) => {
    const context = atRuleContext(rule)
    rule.walkDecls((declaration) => {
      documentDeclarations.push({
        declaration,
        context,
        property: declaration.prop.toLowerCase(),
        selectors: rule.selectors || [rule.selector],
      })
    })
  })

  const laterDeclarations = new Map()
  for (let index = documentDeclarations.length - 1; index >= 0; index -= 1) {
    const entry = documentDeclarations[index]
    const keys = entry.selectors.map(
      (selector) => [entry.context, selector, entry.property].join('\u0000'),
    )
    const isFullySuperseded = keys.every((key) => {
      const later = laterDeclarations.get(key)
      return later && (!entry.declaration.important || later.important)
    })

    if (isFullySuperseded) {
      entry.declaration.remove()
      document.removed += 1
      continue
    }

    for (const key of keys) {
      const later = laterDeclarations.get(key)
      if (!later || (entry.declaration.important && !later.important)) {
        laterDeclarations.set(key, entry.declaration)
      }
    }
  }
}

for (const document of documents) {
  if (document.relativePath === 'src/index.css') {
    // index.css is the remaining legacy compatibility layer. Historical phase
    // narration is kept in version control, not shipped in the active source.
    document.root.walkComments((comment) => {
      comment.remove()
      document.removed += 1
    })
  }

  document.root.walkRules((rule) => {
    if (!rule.nodes?.some((node) => node.type === 'decl' || node.type === 'atrule')) rule.remove()
  })

  if (writeChanges && document.removed > 0) {
    const output = document.relativePath === 'src/index.css'
      ? document.root.toString().replace(/(?:\r?\n){2,}/g, '\n')
      : document.root.toString()
    fs.writeFileSync(document.absolutePath, output)
  }
}

const totalRemoved = documents.reduce((sum, document) => sum + document.removed, 0)
console.log(`${writeChanges ? 'Removed' : 'Found'} ${totalRemoved} redundant CSS entries.`)
for (const document of documents.filter((entry) => entry.removed > 0)) {
  console.log(`- ${document.relativePath}: ${document.removed}`)
}

if (!writeChanges && totalRemoved > 0) {
  console.log('Run npm run consolidate-css to apply this cleanup.')
}
