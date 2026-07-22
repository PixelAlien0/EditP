import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ComparisonValue,
  ParameterRelationshipPanel,
} from './ParameterGuidance.jsx';
import {
  getParameterHelp,
  getParameterRelationship,
  getRelationshipLabel,
} from '../../config/parameterGuidance.js';

describe('parameter guidance', () => {
  it('combines overlapping relationship groups without repeating fields', () => {
    const relationship = getParameterRelationship('weapons', 'commandfire');

    expect(relationship.title).toBe('Commandfire connects 2 systems');
    expect(relationship.keys.filter(key => key === 'commandfire')).toHaveLength(1);
    expect(relationship.keys).toContain('interceptor');
    expect(relationship.keys).toContain('canattack');
  });

  it('provides configured and fallback help text', () => {
    expect(getParameterHelp('health', 'Health')).toBe('Maximum hit points before destruction.');
    expect(getParameterHelp('damage_vs_heavy', 'Heavy damage')).toContain('heavy armor class');
    expect(getParameterHelp('future_field', 'Future field')).toContain('return to the inherited game value');
    expect(getRelationshipLabel('customparams.carried_unit')).toBe('Carried Unit');
  });

  it('navigates between related parameters', () => {
    const onSelect = vi.fn();
    render(
      <ParameterRelationshipPanel
        section="weapons"
        activeKey="damage"
        onSelect={onSelect}
        onClear={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onSelect).toHaveBeenCalledWith('reload');
  });

  it('renders a concise before and after comparison', () => {
    render(<ComparisonValue active before={100} after={125} />);
    expect(screen.getByLabelText('Before 100, after 125')).toBeVisible();
  });
});
