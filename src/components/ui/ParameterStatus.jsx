import { resolveParameterStatuses } from '../../config/parameterStatus.js';
import { Badge } from './Badge.jsx';
import { cx } from './utils.js';

export function ParameterStatus({
  modified,
  source,
  capabilityIds,
  generated,
  external,
  detailed = false,
  className,
}) {
  const statuses = resolveParameterStatuses({ modified, source, capabilityIds, generated, external });
  const accessibleLabel = `Parameter status: ${statuses.map(status => status.label).join(', ')}`;

  return (
    <span className={cx('ui-parameter-status', detailed && 'is-detailed', className)} aria-label={accessibleLabel}>
      <span className="ui-parameter-status__badges">
        {statuses.map(status => (
          <Badge key={status.id} tone={status.tone} size="sm" title={status.description}>
            {status.label}
          </Badge>
        ))}
      </span>
      {detailed && (
        <small>{statuses.map(status => status.description).join(' ')}</small>
      )}
    </span>
  );
}

export default ParameterStatus;

