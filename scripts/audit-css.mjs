import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

const root = path.resolve('src');
const files = [
  path.join(root, 'styles/theme-tokens.css'),
  path.join(root, 'index.css'),
  ...fs.readdirSync(path.join(root, 'styles/features')).sort().map(file => path.join(root, 'styles/features', file)),
  path.join(root, 'components/ui/ui.css')
];

const selectorOwners = new Map();
const selectorLabels = new Map();
let totalBytes = 0;
let totalImportant = 0;

console.log('CSS ownership audit');
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(process.cwd(), file).replaceAll('\\', '/');
  const tree = postcss.parse(source, { from: file });
  let rules = 0;
  let important = 0;

  tree.walkRules(rule => {
    rules += 1;
    rule.selectors?.forEach(selector => {
      const context = [];
      let parent = rule.parent;
      while (parent && parent.type !== 'root') {
        if (parent.type === 'atrule') context.push(`${parent.name}:${parent.params}`);
        parent = parent.parent;
      }
      const contextLabel = context.reverse().join(' > ');
      const selectorKey = `${contextLabel}\u0000${selector}`;
      const owners = selectorOwners.get(selectorKey) || new Set();
      owners.add(relative);
      selectorOwners.set(selectorKey, owners);
      selectorLabels.set(selectorKey, contextLabel ? `${selector} [${contextLabel}]` : selector);
    });
  });
  tree.walkDecls(declaration => {
    if (declaration.important) important += 1;
  });

  totalBytes += Buffer.byteLength(source);
  totalImportant += important;
  console.log(`${relative.padEnd(48)} ${String(rules).padStart(4)} rules  ${String(important).padStart(4)} !important  ${String(Buffer.byteLength(source)).padStart(7)} bytes`);
}

const crossOwned = [...selectorOwners.entries()].filter(([, owners]) => owners.size > 1);
console.log(`\nTotal: ${files.length} files, ${totalBytes} bytes, ${totalImportant} !important declarations`);
console.log(`Selectors owned by more than one file: ${crossOwned.length}`);
crossOwned.slice(0, 20).forEach(([selectorKey, owners]) => console.log(`- ${selectorLabels.get(selectorKey)}: ${[...owners].join(', ')}`));

const budgets = { bytes: 455000, important: 2175, crossOwned: 138 };
const failures = [
  totalBytes > budgets.bytes && `CSS size ${totalBytes} exceeds ${budgets.bytes} bytes`,
  totalImportant > budgets.important && `${totalImportant} !important declarations exceed ${budgets.important}`,
  crossOwned.length > budgets.crossOwned && `${crossOwned.length} shared selectors exceed ${budgets.crossOwned}`,
].filter(Boolean);

if (failures.length) {
  console.error('\nCSS budgets failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('CSS regression budgets passed.');
}
