import { getUnitIconUrl } from '../utils/unitArtwork.js';

export default function UnitArtwork({ unitId, src, alt = '', eager = false, onError, ...props }) {
  const handleError = event => {
    if (event.currentTarget.dataset.fallbackApplied === 'true') return;
    event.currentTarget.dataset.fallbackApplied = 'true';
    event.currentTarget.src = '/logo.svg';
    onError?.(event);
  };

  return (
    <img
      {...props}
      src={src || getUnitIconUrl(unitId)}
      alt={alt}
      width="192"
      height="192"
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      decoding="async"
      onError={handleError}
    />
  );
}
