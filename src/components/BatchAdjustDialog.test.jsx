import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BatchAdjustDialog from './BatchAdjustDialog.jsx';

afterEach(cleanup);

const parameterGroups = [{
  label: 'Structure and cost',
  options: [{ value: 'health', label: 'Health', unit: 'HP', description: 'Maximum durability.' }],
}];

const candidateUnits = [{ id: 'armflash', name: 'Flash', faction: 'arm', tags: ['vehicles', 't1'] }];

const readyPreview = {
  affectedUnitCount: 1,
  affectedFieldCount: 1,
  skippedUnitCount: 0,
  estimatedBase64Chars: 84,
  requiresLargeScopeConfirmation: false,
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
};

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
    candidateUnits,
    selectedUnitIds: ['armflash'],
    currentUnitId: 'armflash',
    scopeLabel: 'Current filters',
    preview: readyPreview,
    onToggleUnit: vi.fn(),
    onSelectUnits: vi.fn(),
    onDeselectUnits: vi.fn(),
    onClearSelection: vi.fn(),
    onApply: vi.fn(),
    ...overrides,
  };
  render(<BatchAdjustDialog {...props} />);
  return props;
}

describe('BatchAdjustDialog', () => {
  it('shows the explicit selection and applies only after preview', async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    expect(screen.getAllByText('Flash').length).toBeGreaterThan(0);
    expect(screen.getByText('1000')).toBeInTheDocument();
    expect(screen.getByText('1100')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apply to 1 unit' }));
    expect(props.onApply).toHaveBeenCalledWith({ allowLargeScope: false });
  });

  it('starts safe and cannot apply without a selected unit', async () => {
    const user = userEvent.setup();
    const props = renderDialog({
      selectedUnitIds: [],
      preview: {
        affectedUnitCount: 0,
        affectedFieldCount: 0,
        estimatedBase64Chars: 0,
        requiresLargeScopeConfirmation: false,
        blocked: true,
        error: 'Select at least one unit before configuring the batch.',
        warnings: [],
        previewRows: [],
      },
    });

    expect(screen.getByText('Select at least one unit before configuring the batch.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply to 0 units' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Flash/ }));
    expect(props.onToggleUnit).toHaveBeenCalledWith('armflash');
  });

  it('requires a second confirmation for a large projected payload', async () => {
    const user = userEvent.setup();
    const props = renderDialog({
      preview: {
        ...readyPreview,
        estimatedBase64Chars: 13000,
        requiresLargeScopeConfirmation: true,
        warnings: ['Large batch: review the selected units and projected payload before confirming this operation.'],
      },
    });

    const applyButton = screen.getByRole('button', { name: 'Apply to 1 unit' });
    expect(applyButton).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /Confirm large export impact/ }));
    expect(applyButton).toBeEnabled();
    await user.click(applyButton);
    expect(props.onApply).toHaveBeenCalledWith({ allowLargeScope: true });
  });

  it('blocks an empty adjustment value', () => {
    renderDialog({ value: '', preview: { affectedUnitCount: 0, affectedFieldCount: 0, estimatedBase64Chars: 0, requiresLargeScopeConfirmation: false, blocked: true, warnings: [], previewRows: [] } });

    expect(screen.getByText('Enter a finite number.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply to 0 units' })).toBeDisabled();
  });
});
