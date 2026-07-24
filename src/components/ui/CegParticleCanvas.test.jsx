import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CegParticleCanvas from './CegParticleCanvas.jsx';

describe('CegParticleCanvas', () => {
  it('renders particle canvas viewport with CEG tag overlay and detonation controls', () => {
    // Mock HTMLCanvasElement getContext for JSDOM
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
    });

    render(<CegParticleCanvas cegTag="custom:PLASMA_EXPLOSION" soundName="xplolrg3" />);

    expect(screen.getByText('custom:PLASMA_EXPLOSION')).toBeInTheDocument();
    expect(screen.getByText('🔊 xplolrg3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Detonate FX/i })).toBeInTheDocument();
  });
});
