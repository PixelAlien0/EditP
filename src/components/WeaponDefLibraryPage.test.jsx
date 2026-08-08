import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WeaponDefLibraryPage from './WeaponDefLibraryPage.jsx';

afterEach(cleanup);

const savedDefinition = {
  id: 'support-1',
  ownerUnitId: 'armflea',
  key: 'cluster_child',
  label: 'Cluster child',
  definition: { damage: { default: 20 } },
  enabled: true,
  mode: 'replace',
  role: 'dependency',
  mountedSlots: [1],
  dependencies: [],
  referencedBy: ['cluster_parent'],
};

function renderLibrary(overrides = {}) {
  const callbacks = {
    onAdd: vi.fn(),
    onUpdate: vi.fn(),
    onRemove: vi.fn(),
    onOpenUnit: vi.fn(),
    onOpenTweakLab: vi.fn(),
    onBack: vi.fn(),
    onNotice: vi.fn(),
  };
  render(
    <WeaponDefLibraryPage
      definitions={[savedDefinition]}
      knownUnits={[{ id: 'armflea' }]}
      tweaks={{}}
      {...callbacks}
      {...overrides}
    />,
  );
  return callbacks;
}

describe('WeaponDefLibraryPage', () => {
  it('shows definition ownership, relationships, and compile state', () => {
    renderLibrary();

    expect(screen.getByRole('heading', { name: 'WeaponDef Library', exact: true })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cluster child' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Definition relationships' })).toHaveTextContent('cluster_parent');
    expect(screen.getByRole('complementary', { name: 'Definition relationships' })).toHaveTextContent('Included in generated TweakDefs');
  });

  it('creates a literal definition from the project catalog', async () => {
    const user = userEvent.setup();
    const callbacks = renderLibrary({ definitions: [] });
    const catalog = screen.getByRole('complementary', { name: 'Supporting WeaponDef catalog' });

    await user.type(within(catalog).getByLabelText('Owner UnitDef'), 'armflea');
    await user.type(within(catalog).getByLabelText('WeaponDef key'), 'cluster_child');
    await user.click(within(catalog).getByRole('button', { name: 'Create definition' }));

    expect(callbacks.onAdd).toHaveBeenCalledWith([
      expect.objectContaining({ ownerUnitId: 'armflea', key: 'cluster_child', enabled: true }),
    ]);
  });

  it('rejects invalid literal JSON without updating project state', async () => {
    const user = userEvent.setup();
    const callbacks = renderLibrary();

    fireEvent.change(screen.getByRole('textbox', { name: 'Literal fields for cluster_child' }), { target: { value: '{invalid' } });
    await user.click(screen.getByRole('button', { name: 'Save fields' }));

    expect(callbacks.onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText(/Expected property name/)).toBeInTheDocument();
  });

  it('requires confirmation before deleting a definition', async () => {
    const user = userEvent.setup();
    const callbacks = renderLibrary();

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(callbacks.onRemove).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(callbacks.onRemove).toHaveBeenCalledWith('support-1');
  });
});
