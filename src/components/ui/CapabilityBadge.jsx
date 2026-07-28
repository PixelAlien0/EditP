import { resolveCapabilityDefinitions } from '../../config/featureCapabilities.js';
import { Badge } from './Badge.jsx';
import { cx } from './utils.js';

export function CapabilityLabels({
  featureId,
  capabilityIds,
  compact = false,
  className,
}) {
  const capabilities = resolveCapabilityDefinitions({ featureId, capabilityIds });
  if (capabilities.length === 0) return null;

  return (
    <span
      className={cx('ui-capability-labels', compact && 'is-compact', className)}
      aria-label={`Capabilities: ${capabilities.map(capability => capability.label).join(', ')}`}
    >
      {capabilities.map(capability => (
        <Badge
          key={capability.id}
          size="sm"
          tone={capability.tone}
          className="ui-capability-label"
          title={capability.description}
        >
          {compact ? capability.shortLabel : capability.label}
        </Badge>
      ))}
    </span>
  );
}

export default CapabilityLabels;
