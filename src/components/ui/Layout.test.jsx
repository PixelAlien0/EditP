import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageShell } from './Layout.jsx';

describe('PageShell', () => {
  it('provides one accessible page header, capability context, metrics, and actions', () => {
    render(
      <PageShell
        eyebrow="Delivery"
        title="Review & Export"
        description="Validate and package the current project."
        capabilityId="workspace.review"
        metrics={[{ label: 'Changes', value: 4 }]}
        actions={<button type="button">Back to editor</button>}
      >
        <section>Compiler output</section>
      </PageShell>,
    );

    expect(screen.getByRole('main', { name: 'Review & Export' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Review & Export' })).toBeInTheDocument();
    expect(screen.getByLabelText('Capabilities: Preflight checked')).toBeInTheDocument();
    expect(screen.getByText('Changes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to editor' })).toBeInTheDocument();
  });

  it('keeps a label-only shell compatible with specialized pages', () => {
    render(<PageShell label="Specialized workspace"><span>Custom content</span></PageShell>);
    expect(screen.getByRole('main', { name: 'Specialized workspace' })).toBeInTheDocument();
  });
});
