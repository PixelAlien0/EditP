import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BatchAdjustDialog from './BatchAdjustDialog.jsx';

afterEach(cleanup);

const parameterGroups = [{
  label: 'Structure and cost',
  options: [{ value: 'health', label: 'Health', unit: 'HP', description: 'Maximum durability.' }],
}];

function renderDialog(overrides = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    parameterGroups,
    statKey: 'health',
    onStatKeyChange: vi.fn(),
    mode: 'percent',
    onModeChange: vi.fn(),
    value: '10',
    onValueChange: vi.fn(),
    targetUnits: [{ id: 'armflash' }],
    scopeLabel: 'Current filters',
    preview: {
      affectedUnitCount: 1,
      affectedFieldCount: 1,
      skippedUnitCount: 0,
      blocked: false,
      warnings: [],
      previewRows: [{
        unitId: 'armflash',
        unitName: 'Flash',
        artworkUnitId: 'armflash',
        key: 'health',
        fieldLabel: 'Health',
        before: '1000',
        after: '1100',
        source: 'BAR',
      }],
    },
    onApply: vi.fn(),
    ...overrides,
  };
  render(<BatchAdjustDialog {...props} />);
  return props;
}

describe('BatchAdjustDialog', () => {
  it('shows exact impact and applies only after preview', async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    expect(screen.getByText('Flash')).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
    expect(screen.getByText('1100')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apply to 1 unit' }));
    expect(props.onApply).toHaveBeenCalledOnce();
  });

  it('blocks an empty adjustment value', () => {
    renderDialog({ value: '', preview: { affectedUnitCount: 0, affectedFieldCount: 0, skippedUnitCount: 1, blocked: true, warnings: [], previewRows: [] } });

    expect(screen.getByText('Enter a finite number.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply to 0 units' })).toBeDisabled();
  });
});
