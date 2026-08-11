import { describe, expect, it } from 'vitest';
import {
  buildDiscoveredKeyReviewArtifact,
  buildDiscoveredKeyReviewQueue,
  filterDiscoveredKeyReviewQueue,
  normalizeDiscoveredKeyReview,
} from './customParameterReview.js';

describe('discovered custom-parameter review queue', () => {
  it('combines declared, consumer-only, and unresolved evidence without trusting unresolved keys', () => {
    const queue = buildDiscoveredKeyReviewQueue();
    expect(queue.some(entry => entry.declarationKind === 'declared')).toBe(true);
    expect(queue.some(entry => entry.declarationKind === 'consumer-only')).toBe(true);
    expect(queue.some(entry => entry.scope === 'unresolved')).toBe(true);
    expect(queue.find(entry => entry.scope === 'unresolved')).toMatchObject({
      promotion: expect.objectContaining({ id: 'unresolved' }),
      confidence: 'uncertain',
    });
  });

  it('filters the default queue to keys that still require review', () => {
    const queue = buildDiscoveredKeyReviewQueue();
    const pending = filterDiscoveredKeyReviewQueue(queue);
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every(entry => ['observed', 'unresolved'].includes(entry.promotion.id))).toBe(true);

    const consumers = filterDiscoveredKeyReviewQueue(queue, { evidence: 'consumer-backed' });
    expect(consumers.every(entry => entry.consumerCount > 0)).toBe(true);
  });

  it('creates a pinned, portable review artifact and sanitizes local annotations', () => {
    const entry = buildDiscoveredKeyReviewQueue().find(item => item.scope !== 'unresolved');
    const review = normalizeDiscoveredKeyReview({ decision: 'candidate', note: '  Confirmed reader.  ' });
    const artifact = buildDiscoveredKeyReviewArtifact(entry, review);
    expect(artifact).toMatchObject({
      version: 1,
      sourceCommit: expect.stringMatching(/^[a-f0-9]{40}$/),
      key: entry.key,
      review: { decision: 'candidate', note: 'Confirmed reader.' },
    });
  });
});
