import { describe, expect, it } from 'vitest';
import { PRESENCE_ACTIVITY, summarizePresenceState } from './presenceActivities.js';

describe('summarizePresenceState', () => {
  it('counts a browser once and uses its newest tab activity', () => {
    const summary = summarizePresenceState({
      browserA: [
        { activity: PRESENCE_ACTIVITY.EDIT_UNITS, activityUpdatedAt: '2026-07-14T01:00:00.000Z' },
        { activity: PRESENCE_ACTIVITY.TOOLS, activityUpdatedAt: '2026-07-14T01:05:00.000Z' }
      ],
      browserB: [{ activity: PRESENCE_ACTIVITY.BUILD_MENUS, activityUpdatedAt: '2026-07-14T01:02:00.000Z' }]
    });

    expect(summary.count).toBe(2);
    expect(summary.activityCounts[PRESENCE_ACTIVITY.TOOLS]).toBe(1);
    expect(summary.activityCounts[PRESENCE_ACTIVITY.EDIT_UNITS]).toBe(0);
    expect(summary.activityCounts[PRESENCE_ACTIVITY.BUILD_MENUS]).toBe(1);
  });

  it('groups older clients without activity metadata as other sessions', () => {
    const summary = summarizePresenceState({ browserA: [{ onlineAt: '2026-07-14T01:00:00.000Z' }] });
    expect(summary.activityCounts[PRESENCE_ACTIVITY.OTHER]).toBe(1);
  });
});
