import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CommunityGalleryPage from './CommunityGalleryPage.jsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const projects = [
  {
    id: 'project-one',
    ownerId: 'creator-one',
    title: 'Armada frontline pass',
    summary: 'A measured frontline rebalance with a revised Bot Lab roster.',
    authorName: 'Workshop Pilot',
    tags: ['balance', 'armada'],
    compatibilityStatus: 'compatible',
    snapshotCommit: 'abcdef1234567890',
    projectVersion: '1.6',
    metrics: { unitEdits: 12, clones: 2, rosterEdits: 4 },
    publishedAt: '2026-08-12T00:00:00.000Z',
    updatedAt: '2026-08-12T00:00:00.000Z',
    downloadCount: 18,
    forkCount: 3,
    hasProjectCopy: true,
    hasLobbyCommands: true,
    exportOptimizationProfile: 'maximum',
    lobbySlotCount: 2,
    lobbyPayloadCharacters: 8192,
  },
];

describe('CommunityGalleryPage', () => {
  it('loads public projects and presents the selected project dossier', async () => {
    const loadProjects = vi.fn().mockResolvedValue({ projects, total: 1, configured: true });
    render(<CommunityGalleryPage onBack={vi.fn()} loadProjects={loadProjects} />);

    expect(await screen.findAllByRole('heading', { name: 'Armada frontline pass' })).toHaveLength(2);
    expect(screen.getAllByText('Workshop Pilot')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Open as copy' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Copy all !bset commands' })).toBeEnabled();
    expect(screen.getAllByText('Maximum').length).toBeGreaterThan(0);
    expect(screen.getByText('Sanitized project copy')).toBeInTheDocument();
  });

  it('sends search and compatibility controls to the paginated loader', async () => {
    const loadProjects = vi.fn().mockResolvedValue({ projects: [], total: 0, configured: true });
    render(<CommunityGalleryPage onBack={vi.fn()} loadProjects={loadProjects} />);
    await screen.findByText('No projects have been published yet');

    fireEvent.change(screen.getByLabelText('Search projects'), { target: { value: 'air power' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.change(screen.getByLabelText('Compatibility'), { target: { value: 'compatible' } });
    fireEvent.change(screen.getByLabelText('Tag'), { target: { value: 'armada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(loadProjects).toHaveBeenLastCalledWith(expect.objectContaining({
      page: 1,
      search: 'air power',
      tag: 'armada',
      compatibility: 'compatible',
    })));
  });

  it('opens a published project as an independent copy', async () => {
    const openProjectCopy = vi.fn().mockResolvedValue({ id: 'project-one', title: 'Armada frontline pass', document: { version: '1.9' } });
    const onOpenCopy = vi.fn();
    render(
      <CommunityGalleryPage
        onBack={vi.fn()}
        onOpenCopy={onOpenCopy}
        loadProjects={vi.fn().mockResolvedValue({ projects, total: 1, configured: true })}
        openProjectCopy={openProjectCopy}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Open as copy' }));
    await waitFor(() => expect(onOpenCopy).toHaveBeenCalledWith({ version: '1.9' }, 'Armada frontline pass'));
  });

  it('copies the published lobby artifact without opening the project', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const loadLobbyCommands = vi.fn().mockResolvedValue({
      commands: '!bset tweakdefs1 QUJD',
      optimizationProfile: 'maximum',
      slotCount: 1,
      payloadCharacters: 4,
    });
    const onOpenCopy = vi.fn();
    render(
      <CommunityGalleryPage
        onBack={vi.fn()}
        onOpenCopy={onOpenCopy}
        loadProjects={vi.fn().mockResolvedValue({ projects, total: 1, configured: true })}
        loadLobbyCommands={loadLobbyCommands}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Copy all !bset commands' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('!bset tweakdefs1 QUJD'));
    expect(loadLobbyCommands).toHaveBeenCalledWith('project-one');
    expect(onOpenCopy).not.toHaveBeenCalled();
    expect(screen.getByText(/Copied 1 lobby field using the Maximum profile/)).toBeInTheDocument();
  });

  it('explains when Supabase has not been configured', async () => {
    const loadProjects = vi.fn().mockResolvedValue({ projects: [], total: 0, configured: false });
    render(<CommunityGalleryPage onBack={vi.fn()} loadProjects={loadProjects} />);

    expect(await screen.findByText('Community gallery is not connected')).toBeInTheDocument();
    expect(screen.getByText(/community-gallery\.sql/)).toBeInTheDocument();
  });
});
