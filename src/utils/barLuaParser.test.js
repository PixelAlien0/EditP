import { describe, expect, it } from 'vitest';
import { extractCoreUnitDefaults, parseLua } from '../../sync_github_data.js';

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

  it('parses special-unit files with scalar locals before the returned table', () => {
    const parsed = parseLua(`
      local unitName = "Epic Supporter"
      return {
        coresuppt3 = {
          name = unitName,
          metalcost = 30000,
          health = 89000,
        },
      }
    `);

    expect(parsed.coresuppt3).toMatchObject({
      name: 'Epic Supporter',
      metalcost: 30000,
      health: 89000,
    });
  });

  it('normalizes legacy BAR economy, durability, and movement field names', () => {
    expect(extractCoreUnitDefaults({
      buildcostmetal: 9000,
      buildcostenergy: 240000,
      maxdamage: 56000,
      acceleration: 0.02,
      brakerate: 0.04,
      speed: 48,
    })).toEqual({
      metalcost: 9000,
      energycost: 240000,
      health: 56000,
      acceleration: 0.02,
      brakerate: 0.04,
      maxvelocity: 48,
    });
  });

  it('protects quoted metadata and accepts Lua table semicolons and nil', () => {
    const parsed = parseLua(`
      return {
        armraz = {
          optional = nil,
          weapondefs = {
            railgun = {
              tolerance = 5000;
              comment = "burstcontrolwhenoutofarc = 2, fastautoretargeting",
            },
          },
        },
      }
    `);

    expect(parsed.armraz.optional).toBeNull();
    expect(parsed.armraz.weapondefs.railgun).toMatchObject({
      tolerance: 5000,
      comment: 'burstcontrolwhenoutofarc = 2, fastautoretargeting',
    });
  });
});
