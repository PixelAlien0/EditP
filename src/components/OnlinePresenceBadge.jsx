export default function OnlinePresenceBadge({ count, status, compact = false }) {
  if (status === 'unconfigured') return null;

  const connected = status === 'connected' && Number.isFinite(count);
  const label = connected
    ? `${count} ${count === 1 ? 'editor' : 'editors'} online`
    : status === 'unavailable'
      ? 'Presence unavailable'
      : 'Connecting';

  return (
    <span
      className={`online-presence ${connected ? 'is-connected' : 'is-pending'} ${compact ? 'is-compact' : ''}`}
      role="status"
      aria-live="polite"
      title={connected ? `${count} unique browser${count === 1 ? '' : 's'} currently connected` : label}
    >
      <span className="online-presence__dot" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
