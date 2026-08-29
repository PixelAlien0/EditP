import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { collectCegCatalog, evaluateCegDefinitionNames } from '../../scripts/lib/ceg-catalog.mjs';

const temporaryDirectories = [];

afterEach(() => {
  temporaryDirectories.splice(0).forEach(directory => fs.rmSync(directory, { recursive: true, force: true }));
});

describe('BAR CEG catalog discovery', () => {
  it('evaluates generated definition names instead of only matching source literals', () => {
    const names = evaluateCegDefinitionNames(`
      local definitions = { ["impact-small"] = { flash = {} } }
      for _, size in ipairs({ "medium", "large" }) do
        definitions["impact-" .. size] = table.copy(definitions["impact-small"])
      end
      return definitions
    `);

    expect(names.sort()).toEqual(['impact-large', 'impact-medium', 'impact-small']);
  });

  it('recursively collects and de-duplicates returned CEG definitions', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'editp-cegs-'));
    temporaryDirectories.push(directory);
    fs.mkdirSync(path.join(directory, 'scavengers'));
    fs.writeFileSync(path.join(directory, 'base.lua'), 'return { Alpha = {}, beta = {} }');
    fs.writeFileSync(path.join(directory, 'scavengers', 'more.lua'), 'return { ALPHA = {}, gamma = {} }');

    const catalog = collectCegCatalog(directory, { strict: true });

    expect(catalog).toMatchObject({ filesScanned: 2, filesLoaded: 2, failures: [] });
    expect(catalog.names.map(name => name.toLowerCase())).toEqual(['alpha', 'beta', 'gamma']);
  });
});
