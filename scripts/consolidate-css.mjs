import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import postcss from 'postcss'

const rootDir = process.cwd()
const writeChanges = process.argv.includes('--write')
const stylesheetOrder = [
  'src/styles/theme-tokens.css',
  'src/styles/base.css',
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
  'src/styles/features/mutation-lab.css',
  'src/styles/features/accessibility.css',
  'src/styles/features/preset-gallery.css',
  'src/styles/features/editor-context.css',
  'src/styles/features/editor-workbench.css',
  'src/styles/features/weapon-borrow.css',
  'src/styles/features/carrier-drone-workbench.css',
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

// Keep only explicit removals for dormant component generations that predate
// the current canonical owners.
const legacyOwnershipMigrations = [
  {
    document: 'src/styles/features/editor-context.css',
    selectors: ['.editor-section-tabs'],
  },
  {
    // These cards and the standalone comparison toolbar were replaced by the
    // operational overview and the unified inspector.
    document: 'src/styles/features/editor-context.css',
    selectors: [
      '.editor-workspace .unit-profile-card',
      '.unit-profile-',
      '.clone-identity-card',
      '.comparison-mode-',
      '.unit-override-badge',
      '.reset-unit-btn',
    ],
  },
  {
    // Preset cards were removed when the carrier workbench became
    // configuration-driven.
    document: 'src/styles/features/carrier-drone-workbench.css',
    selectors: ['.carrier-workbench__preset'],
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

// Once the legacy header generation is gone, header.css is loaded after the
// reset/theme layers and its scoped selectors own the component outright.
// Its old importance flags are therefore unnecessary cascade debt.
const canonicalHeaderDocument = documents.find(
  (entry) => entry.relativePath === 'src/styles/features/header.css',
)
canonicalHeaderDocument?.root.walkDecls((declaration) => {
  if (!declaration.important) return
  const selector = declaration.parent?.selector || ''
  const isPrimaryActionContract = selector.includes('.header-create-action')
    && ['border-color', 'background', 'color'].includes(declaration.prop)
  if (isPrimaryActionContract) return
  declaration.important = false
  canonicalHeaderDocument.removed += 1
})

// Canonical feature owners load in a deliberate order. Their former importance
// flags were migration scaffolding rather than part of the component contract.
const canonicalFeatureOwners = new Set([
  'src/styles/features/batch-adjust.css',
  'src/styles/features/build-menu.css',
  'src/styles/features/editor-context.css',
  'src/styles/features/editor-parameters.css',
  'src/styles/features/mutation-lab.css',
  'src/styles/features/preset-gallery.css',
  'src/styles/features/project-changes.css',
  'src/styles/features/sidebar.css',
  'src/styles/features/weapon-borrow.css',
])
documents
  .filter(document => canonicalFeatureOwners.has(document.relativePath))
  .forEach(document => {
    document.root.walkDecls((declaration) => {
      if (!declaration.important) return
      declaration.important = false
      document.removed += 1
    })
  })

// The Edit Units workbench still contains normal declarations whose cascade
// position is intentional. Scope only the declarations that previously used
// !important: raising every selector would also promote dormant presentation
// rules above the established responsive component styles.
const workbenchDocument = documents.find(
  (entry) => entry.relativePath === 'src/styles/features/editor-workbench.css',
)

function scopeWorkbenchSelector(selector) {
  if (selector.includes('.main-layout.editor-shell')) return selector
  if (selector.startsWith('.editor-shell')) {
    return selector.replace('.editor-shell', '.main-layout.editor-shell')
  }
  if (selector.startsWith('[data-theme=')) {
    const splitAt = selector.indexOf(']') + 1
    return `${selector.slice(0, splitAt)} .main-layout.editor-shell ${selector.slice(splitAt).trim()}`
  }
  if (selector.startsWith('.density-compact ')) {
    return selector.replace('.density-compact ', '.main-layout.editor-shell.density-compact ')
  }
  if (selector.startsWith('.density-comfortable ')) {
    return selector.replace('.density-comfortable ', '.main-layout.editor-shell.density-comfortable ')
  }
  return `.main-layout.editor-shell ${selector}`
}

workbenchDocument?.root.walkRules((rule) => {
  const forcedDeclarations = rule.nodes.filter(
    (node) => node.type === 'decl' && node.important,
  )
  if (forcedDeclarations.length === 0) return

  const scopedRule = rule.clone({
    selector: rule.selectors.map(scopeWorkbenchSelector).join(',\n'),
    nodes: forcedDeclarations.map((declaration) => declaration.clone({ important: false })),
  })
  rule.after(scopedRule)
  forcedDeclarations.forEach((declaration) => declaration.remove())
  if (rule.nodes.every((node) => node.type === 'comment')) rule.remove()
  workbenchDocument.removed += forcedDeclarations.length
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
  document.root.walkRules((rule) => {
    if (!rule.nodes?.some((node) => node.type === 'decl' || node.type === 'atrule')) rule.remove()
  })

  if (writeChanges && document.removed > 0) {
    fs.writeFileSync(document.absolutePath, document.root.toString())
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
