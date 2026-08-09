import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BarReferenceLibraryPage from './BarReferenceLibraryPage.jsx';

const audioInstances = [];

class AudioStub {
  constructor(src) {
    this.src = src;
    this.currentTime = 0;
    this.pause = vi.fn();
    this.play = vi.fn(() => Promise.resolve());
    audioInstances.push(this);
  }
}

const units = [{ id: 'armtest', name: 'Test unit', faction: 'arm' }];
const defaultsDb = {
  armtest: {
    health: 100,
    weaponSlots: [{
      slot: 1,
      defKey: 'test_weapon',
      weapontype: 'MissileLauncher',
      soundstart: 'alien_electric_xl',
    }],
  },
};

function renderLibrary(overrides = {}) {
  const callbacks = {
    onBack: vi.fn(),
    onOpenUnit: vi.fn(),
    onToast: vi.fn(),
  };
  render(
    <BarReferenceLibraryPage
      units={units}
      defaultsDb={defaultsDb}
      explosionProfiles={{}}
      {...callbacks}
      {...overrides}
    />,
  );
  return callbacks;
}

beforeEach(() => {
  audioInstances.length = 0;
  vi.stubGlobal('Audio', AudioStub);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('BarReferenceLibraryPage', () => {
  it('filters the catalog and clears the active search', async () => {
    const user = userEvent.setup();
    renderLibrary();

    await user.click(screen.getByRole('button', { name: /Sounds/i }));
    await user.type(screen.getByRole('searchbox', { name: 'Search the library' }), 'alien_electric_xl');

    expect(screen.getByRole('list', { name: 'Matching BAR references' })).toHaveTextContent('alien_electric_xl');
    await user.click(screen.getByRole('button', { name: 'Clear reference search' }));
    expect(screen.getByRole('searchbox', { name: 'Search the library' })).toHaveValue('');
  });

  it('previews a selected BAR sound through the shared audio player', async () => {
    const user = userEvent.setup();
    renderLibrary();

    await user.click(screen.getByRole('button', { name: /Sounds/i }));
    await user.type(screen.getByRole('searchbox', { name: 'Search the library' }), 'alien_electric_xl');
    const inspector = screen.getByRole('complementary', { name: 'Reference details' });
    await user.click(within(inspector).getByRole('button', { name: /Play sound preview/i }));

    await waitFor(() => expect(audioInstances).toHaveLength(1));
    act(() => audioInstances[0].oncanplay());
    expect(audioInstances[0].src).toContain('alien_electric_xl.wav');
    expect(audioInstances[0].play).toHaveBeenCalledOnce();
    expect(within(inspector).getByRole('button', { name: /Stop preview/i })).toBeInTheDocument();
  });

  it('opens the owning unit from a mounted weapon reference', () => {
    const callbacks = renderLibrary();
    fireEvent.click(screen.getByRole('button', { name: /Weapons/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Open unit editor' }));
    expect(callbacks.onOpenUnit).toHaveBeenCalledWith('armtest');
  });
});
