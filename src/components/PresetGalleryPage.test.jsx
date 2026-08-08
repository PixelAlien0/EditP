import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PresetGalleryPage from './PresetGalleryPage.jsx';

afterEach(cleanup);

const presets = [
  {
    id: 'preset-alpha',
    name: 'Alpha balance pass',
    description: 'Faster aircraft experiment',
    createdAt: '2026-07-13T00:00:00.000Z',
    snapshot: {
      tweaks: { armflash: { maxdamage: 900 } },
      clones: [{ id: 'armflash_mk2' }],
      buildMenuSteps: [{ factoryId: 'armlab' }],
    },
  },
  {
    id: 'preset-beta',
    name: 'Beta economy pass',
    description: 'Lower factory costs',
    createdAt: '2026-07-14T00:00:00.000Z',
    snapshot: {
      tweaks: { armlab: { metalcost: 400 } },
      clones: [],
      buildMenuSteps: [],
    },
  },
];

function renderGallery(overrides = {}) {
  const handlers = {
    onPresetNameChange: vi.fn(),
    onPresetDescriptionChange: vi.fn(),
    onSave: vi.fn(),
    onApply: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
  };

  render(<PresetGalleryPage
    presets={presets}
    projectName="BAR EDITP"
    presetName="Current experiment"
    presetDescription="A useful checkpoint"
    {...handlers}
    {...overrides}
  />);

  return handlers;
}

describe('PresetGalleryPage', () => {
  it('presents capture and library workflows while preserving editor callbacks', () => {
    const handlers = renderGallery();

    expect(screen.getByRole('heading', { name: 'Preset Gallery' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Save the current project' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Project snapshots' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Alpha balance pass' }).closest('article')).toHaveTextContent('3 recorded changes');

    fireEvent.change(screen.getByLabelText('Preset name'), { target: { value: 'New checkpoint' } });
    fireEvent.change(screen.getByLabelText('Design note'), { target: { value: 'New note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save current preset' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Open preset' })[0]);

    expect(handlers.onPresetNameChange).toHaveBeenCalledWith('New checkpoint');
    expect(handlers.onPresetDescriptionChange).toHaveBeenCalledWith('New note');
    expect(handlers.onSave).toHaveBeenCalledOnce();
    expect(handlers.onApply).toHaveBeenCalledWith(expect.objectContaining({ id: 'preset-beta' }));
  });

  it('filters the library and confirms destructive deletion', () => {
    const handlers = renderGallery();

    fireEvent.change(screen.getByLabelText('Search saved presets'), { target: { value: 'aircraft' } });
    expect(screen.getByText('Alpha balance pass')).toBeInTheDocument();
    expect(screen.queryByText('Beta economy pass')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Alpha balance pass' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Delete this preset?');
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));

    expect(handlers.onDelete).toHaveBeenCalledWith('preset-alpha');
  });

  it('offers recovery when a search has no matches', () => {
    renderGallery();

    fireEvent.change(screen.getByLabelText('Search saved presets'), { target: { value: 'missing preset' } });
    expect(screen.getByText('No presets match')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByText('Alpha balance pass')).toBeInTheDocument();
    expect(screen.getByText('Beta economy pass')).toBeInTheDocument();
  });
});
