import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import InheritedBooleanControl from './InheritedBooleanControl.jsx';

describe('InheritedBooleanControl', () => {
  it('distinguishes an inherited false value from an explicit false override', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <InheritedBooleanControl label="Blocks movement" inheritedValue={false} modified={false} onChange={onChange} />
    );

    const control = screen.getByRole('combobox', { name: 'Blocks movement override' });
    expect(control).toHaveValue('');
    expect(control).toHaveTextContent('Inherited · Disabled');

    fireEvent.change(control, { target: { value: 'true' } });
    expect(onChange).toHaveBeenCalledWith(true);

    rerender(
      <InheritedBooleanControl label="Blocks movement" inheritedValue={false} modified value={false} onChange={onChange} />
    );
    expect(control).toHaveValue('false');
  });

  it('resets an override by selecting inherited', () => {
    const onChange = vi.fn();
    render(
      <InheritedBooleanControl label="Can cloak" modified value onChange={onChange} />
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Can cloak override' }), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
