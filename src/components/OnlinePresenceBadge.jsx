import { useEffect, useId, useRef, useState } from 'react';
import {
  PRESENCE_ACTIVITY,
  PRESENCE_ACTIVITY_ITEMS
} from '../config/presenceActivities.js';

export default function OnlinePresenceBadge({
  count,
  status,
  activityCounts = {},
  currentActivity = PRESENCE_ACTIVITY.EDIT_UNITS,
  compact = false
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = event => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (status !== 'connected') setOpen(false);
  }, [status]);

  if (status === 'unconfigured') return null;

  const connected = status === 'connected' && Number.isFinite(count);
  const visibleCount = connected ? count : '—';
  const statusLabel = connected
    ? `${count} ${count === 1 ? 'editor' : 'editors'} online`
    : status === 'unavailable'
      ? 'Presence unavailable'
      : 'Connecting to editor presence';
  const otherCount = activityCounts[PRESENCE_ACTIVITY.OTHER] || 0;

  return (
    <div
      ref={rootRef}
      className={`online-presence ${connected ? 'is-connected' : 'is-pending'} ${compact ? 'is-compact' : ''}`}
    >
      <button
        ref={triggerRef}
        type="button"
        className="online-presence__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={statusLabel}
        title={statusLabel}
        disabled={!connected}
        onClick={() => setOpen(current => !current)}
      >
        <span className="online-presence__dot" aria-hidden="true" />
        <span className="online-presence__count" aria-live="polite">{visibleCount}</span>
        <span className="online-presence__wording">
          {compact ? 'online' : count === 1 ? 'editor online' : 'editors online'}
        </span>
        <svg className="online-presence__chevron" viewBox="0 0 12 12" aria-hidden="true">
          <path d="m3 4.5 3 3 3-3" />
        </svg>
      </button>

      {open && (
        <section className="online-presence__panel" id={panelId} aria-label="Editor activity breakdown">
          <header className="online-presence__panel-header">
            <div>
              <span>Live workshop</span>
              <strong>Editor activity</strong>
            </div>
            <span>{count} total</span>
          </header>

          <div className="online-presence__activity-list">
            {PRESENCE_ACTIVITY_ITEMS.map(item => {
              const isCurrent = item.id === currentActivity;
              return (
                <div className={`online-presence__activity ${isCurrent ? 'is-current' : ''}`} key={item.id}>
                  <span className="online-presence__activity-mark" aria-hidden="true" />
                  <span className="online-presence__activity-name">
                    <strong>{item.label}</strong>
                    {isCurrent && <small>You are here</small>}
                  </span>
                  <span className="online-presence__activity-count">{activityCounts[item.id] || 0}</span>
                </div>
              );
            })}
            {otherCount > 0 && (
              <div className="online-presence__activity">
                <span className="online-presence__activity-mark" aria-hidden="true" />
                <span className="online-presence__activity-name"><strong>Other session</strong></span>
                <span className="online-presence__activity-count">{otherCount}</span>
              </div>
            )}
          </div>

          <footer>Anonymous browser presence · no project data shared</footer>
        </section>
      )}
    </div>
  );
}
