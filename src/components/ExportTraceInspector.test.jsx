import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { compileLobbyModules } from '../utils/lobbyModules.js';
import ExportTraceInspector from './ExportTraceInspector.jsx';

function buildCompiledPackage() {
  return compileLobbyModules({
    tweakModules: [],
    generatedTweakDefsLua: '-- EDITP_BUILDMENU_BEGIN\nlocal menu = true\n-- EDITP_BUILDMENU_END',
    generatedTweakUnitsLua: '{ armflash = { health = 1200, }, }',
  });
}

describe('ExportTraceInspector', () => {
  it('shows the source-to-slot path and filters traces by output lane', async () => {
    const user = userEvent.setup();
    render(<ExportTraceInspector compiledModules={buildCompiledPackage()} />);

    await user.click(screen.getByText('Export Trace Inspector'));
    expect(screen.getByText('Source-to-delivery map')).toBeInTheDocument();
    expect(screen.getAllByText('tweakdefs1').length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByLabelText('Output lane'), 'units');
    const traceIndex = screen.getByRole('navigation', { name: 'Compiler block traces' });
    expect(within(traceIndex).getByText('tweakunits1')).toBeInTheDocument();
    expect(within(traceIndex).queryByText('tweakdefs1')).not.toBeInTheDocument();
  });
});
