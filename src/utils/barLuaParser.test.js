import { describe, expect, it } from 'vitest';
import { parseLua } from '../../sync_github_data.js';

describe('BAR Lua data parser', () => {
  it('parses factory yardmaps stored in multiline Lua strings', () => {
    const parsed = parseLua(`
      return {
        legvp = {
          yardmap = [[h
            oo oo oo
            oe ee oo
          ]],
          buildoptions = {
            [1] = "legscout",
            [2] = "legcv",
          },
        },
      }
    `);

    expect(parsed.legvp.yardmap).toContain('oe ee oo');
    expect(Object.values(parsed.legvp.buildoptions)).toEqual(['legscout', 'legcv']);
  });

  it('supports unindexed build options and protected long-string comments', () => {
    const parsed = parseLua(`
      return {
        legavp = {
          yardmap = [=[h -- this belongs to the yardmap
            oo ee oo
          ]=],
          buildoptions = { "legacv", "legmrv" }, -- actual comment
        },
      }
    `);

    expect(parsed.legavp.yardmap).toContain('-- this belongs to the yardmap');
    expect(parsed.legavp.buildoptions).toEqual(['legacv', 'legmrv']);
  });
});
