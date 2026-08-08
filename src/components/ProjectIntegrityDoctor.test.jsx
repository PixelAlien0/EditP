import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProjectIntegrityDoctor from './ProjectIntegrityDoctor.jsx';

const repairFinding = {
  id: 'integrity-build-menu-cleanup',
  category: 'Build menus',
  severity: 'error',
  title: 'Build Menu graph contains stale operations',
  detail: 'Stale roster references can be removed.',
  action: { type: 'build-menu', label: 'Review Build Menus' },
  repair: { id: 'clean-build-menus', label: 'Clean Build Menus', safety: 'safe' },
};

afterEach(cleanup);

describe('ProjectIntegrityDoctor', () => {
  it('runs one safe repair or all safe repairs', () => {
    const onRepair = vi.fn();
    render(<ProjectIntegrityDoctor report={{ status: 'repair', findings: [repairFinding], repairableCount: 1, reviewCount: 0 }} onRepair={onRepair} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clean Build Menus' }));
    expect(onRepair).toHaveBeenCalledWith(['clean-build-menus']);
    fireEvent.click(screen.getByRole('button', { name: 'Repair all safe issues' }));
    expect(onRepair).toHaveBeenLastCalledWith([]);
  });

  it('routes manual review actions without presenting an automatic repair', () => {
    const onAction = vi.fn();
    const finding = {
      id: 'integrity-clone-unassigned', category: 'Clone production', severity: 'warning',
      title: 'Clone has no production path', detail: 'Choose a producer.',
      action: { type: 'build-menu', unitId: 'clone_one', label: 'Assign producer' },
    };
    render(<ProjectIntegrityDoctor report={{ status: 'review', findings: [finding], repairableCount: 0, reviewCount: 1 }} onAction={onAction} />);

    fireEvent.click(screen.getByRole('button', { name: 'Assign producer' }));
    expect(onAction).toHaveBeenCalledWith(finding.action);
    expect(screen.queryByRole('button', { name: 'Repair all safe issues' })).not.toBeInTheDocument();
  });

  it('renders a compact healthy state', () => {
    render(<ProjectIntegrityDoctor />);
    expect(screen.getByText('Project graph is coherent')).toBeInTheDocument();
    expect(screen.getByText('No integrity drift detected')).toBeInTheDocument();
  });
});
