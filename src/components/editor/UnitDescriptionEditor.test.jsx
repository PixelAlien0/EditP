import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import UnitDescriptionEditor from './UnitDescriptionEditor.jsx';

afterEach(cleanup);

function renderEditor(overrides = {}) {
  const props = {
    unitId: 'armflash',
    unitName: 'Flash',
    inheritedDescription: 'Fast assault tank',
    value: '',
    onCommit: vi.fn(),
    ...overrides,
  };
  render(<UnitDescriptionEditor {...props} />);
  return props;
}

describe('UnitDescriptionEditor', () => {
  it('keeps keystrokes local and commits once when focus leaves the editor', () => {
    const props = renderEditor();
    const input = screen.getByLabelText('Custom description for Flash');

    fireEvent.change(input, { target: { value: 'Custom raider' } });
    fireEvent.change(input, { target: { value: 'Custom raider role' } });

    expect(props.onCommit).not.toHaveBeenCalled();
    fireEvent.blur(input, { relatedTarget: null });
    expect(props.onCommit).toHaveBeenCalledTimes(1);
    expect(props.onCommit).toHaveBeenCalledWith('Custom raider role');
  });

  it('applies a draft once with the explicit action', () => {
    const props = renderEditor();
    fireEvent.change(screen.getByLabelText('Custom description for Flash'), {
      target: { value: 'Updated description' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Apply description' }));

    expect(props.onCommit).toHaveBeenCalledTimes(1);
    expect(props.onCommit).toHaveBeenCalledWith('Updated description');
  });

  it('restores the inherited value as one project change', () => {
    const props = renderEditor({ value: 'Existing override' });

    fireEvent.click(screen.getByRole('button', { name: 'Restore inherited' }));

    expect(props.onCommit).toHaveBeenCalledTimes(1);
    expect(props.onCommit).toHaveBeenCalledWith('');
  });
});
