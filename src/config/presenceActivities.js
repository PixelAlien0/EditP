export const PRESENCE_ACTIVITY = Object.freeze({
  MAIN_MENU: 'main-menu',
  EDIT_UNITS: 'edit-units',
  BUILD_MENUS: 'build-menus',
  REVIEW_EXPORT: 'review-export',
  TOOLS: 'tools',
  OTHER: 'other'
});

export const PRESENCE_ACTIVITY_ITEMS = Object.freeze([
  { id: PRESENCE_ACTIVITY.MAIN_MENU, label: 'Main Menu' },
  { id: PRESENCE_ACTIVITY.EDIT_UNITS, label: 'Edit Units' },
  { id: PRESENCE_ACTIVITY.BUILD_MENUS, label: 'Build Menus' },
  { id: PRESENCE_ACTIVITY.REVIEW_EXPORT, label: 'Review & Export' },
  { id: PRESENCE_ACTIVITY.TOOLS, label: 'Tools' }
]);

const KNOWN_ACTIVITIES = new Set(PRESENCE_ACTIVITY_ITEMS.map(item => item.id));

export function normalizePresenceActivity(activity) {
  return KNOWN_ACTIVITIES.has(activity) ? activity : PRESENCE_ACTIVITY.OTHER;
}

export function createPresenceActivityCounts() {
  return Object.fromEntries(
    [...PRESENCE_ACTIVITY_ITEMS, { id: PRESENCE_ACTIVITY.OTHER }].map(item => [item.id, 0])
  );
}

function getPresenceTimestamp(meta) {
  const timestamp = Date.parse(meta?.activityUpdatedAt || meta?.onlineAt || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function summarizePresenceState(state) {
  const activityCounts = createPresenceActivityCounts();
  let count = 0;

  Object.values(state || {}).forEach(entries => {
    if (!Array.isArray(entries) || entries.length === 0) return;

    const latest = entries.reduce((selected, entry) => (
      !selected || getPresenceTimestamp(entry) >= getPresenceTimestamp(selected) ? entry : selected
    ), null);

    count += 1;
    activityCounts[normalizePresenceActivity(latest?.activity)] += 1;
  });

  return { count, activityCounts };
}
