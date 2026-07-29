import { describe, expect, it } from 'vitest';
import { auditParameterCompleteness } from '../../scripts/audit-parameters.mjs';

describe('parameter completeness audit', () => {
  it('keeps the bundled snapshot, editor controls, and compiler schemas aligned', () => {
    const report = auditParameterCompleteness();

    expect(report.ok).toBe(true);
    expect(report.blockers).toEqual([]);
    expect(report.counts.units).toBeGreaterThan(1_000);
    expect(report.counts.unitParameters).toBeGreaterThan(100);
    expect(report.counts.renderedWeaponParameters).toBeGreaterThan(150);
    expect(report.counts.compatibilityWeaponFields).toBe(5);
    expect(report.warnings.join('\n')).not.toContain('compiler-only weapon fields');
    expect(report.warnings.join('\n')).not.toContain('parameters using generic help');
  });

  it('blocks unknown snapshot fields instead of silently dropping them', () => {
    const report = auditParameterCompleteness({
      defaultsDb: {
        audit_probe: {
          unknown_unit_field: 1,
          weaponSlots: [{
            slot: 1,
            defKey: 'audit_weapon',
            unknown_weapon_field: 1,
          }],
        },
      },
    });

    expect(report.ok).toBe(false);
    expect(report.blockers.join('\n')).toContain('unknown_unit_field');
    expect(report.blockers.join('\n')).toContain('unknown_weapon_field');
  });
});
