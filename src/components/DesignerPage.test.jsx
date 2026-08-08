import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DesignerPage from './DesignerPage.jsx';

afterEach(cleanup);

function renderDesigner(overrides = {}) {
  const handlers = {
    onToggleRosterPack: vi.fn(),
    onProducerSearchChange: vi.fn(),
    onProducerFactionChange: vi.fn(),
    onProducerKindChange: vi.fn(),
    onSelectProducer: vi.fn(),
    onResetProducer: vi.fn(),
    onReorderRoster: vi.fn(),
    onRemoveRosterUnit: vi.fn(),
    onRestoreRosterUnit: vi.fn(),
    onAvailableSearchChange: vi.fn(),
    onAvailableFactionChange: vi.fn(),
    onAddRosterUnit: vi.fn(),
    onClose: vi.fn(),
  };

  render(<DesignerPage
    factoryId="armlab"
    factoryName="Bot Lab"
    factoryIconUrl="/logo.svg"
    activeSlotCount={1}
    changeCount={1}
    rosterPacks={{ extraUnits: true }}
    packDefinitions={{
      extraUnits: {
        label: 'Extra Units Pack',
        description: 'Optional units.',
        additions: { armlab: ['armtest'] },
      },
    }}
    producerCatalog={[{
      id: 'armlab', name: 'Bot Lab', faction: 'arm', kind: 'factory', kindLabel: 'Factory', tier: 'T1', rosterSize: 1,
    }]}
    producerCounts={{ all: 1, factory: 1, builder: 0 }}
    producerSearch=""
    producerFaction="all"
    producerKind="all"
    rosterItems={[{ id: 'armtest', name: 'Test Unit', status: 'added' }]}
    availableUnits={[{ id: 'armother', name: 'Other Unit', rosterStatus: '' }]}
    availableSearch=""
    availableFaction="factory"
    getUnitIconUrl={() => '/logo.svg'}
    isFactoryModified={() => true}
    {...handlers}
    {...overrides}
  />);

  return handlers;
}

describe('DesignerPage', () => {
  it('presents producer, sequence, roster status, and library as one workbench', () => {
    renderDesigner();

    expect(screen.getByRole('heading', { name: 'Factory Roster Designer' })).toBeInTheDocument();
    expect(screen.getByText('Roster conditions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bot Lab armlab/i })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByLabelText('Roster status')).toHaveTextContent('Custom1');
    expect(screen.getByRole('group', { name: 'Custom roster slot 1: Test Unit' })).toHaveTextContent('Custom');
    expect(screen.getByRole('button', { name: 'Remove Test Unit from Bot Lab' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Other Unit' })).toBeEnabled();
  });

  it('keeps filters and production actions wired to their existing callbacks', () => {
    const handlers = renderDesigner();

    fireEvent.change(screen.getByLabelText('Search producers'), { target: { value: 'air' } });
    fireEvent.click(screen.getByRole('button', { name: /Factories/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Other Unit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset roster' }));

    expect(handlers.onProducerSearchChange).toHaveBeenCalledWith('air');
    expect(handlers.onProducerKindChange).toHaveBeenCalledWith('factory');
    expect(handlers.onAddRosterUnit).toHaveBeenCalledWith('armother');
    expect(handlers.onResetProducer).toHaveBeenCalledOnce();
  });
});
