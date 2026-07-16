import { Button, ButtonGroup } from '../ui.jsx';

export default function UnitParameterViewControl({ showAll, visibleCount, totalCount, onChange }) {
  return (
    <div className="unit-parameter-view" aria-label="Unit parameter view">
      <span className="section-heading__meta">{visibleCount} of {totalCount}</span>
      <ButtonGroup className="unit-parameter-view__options" label="Choose visible unit parameters">
        <Button
          size="sm"
          variant={!showAll ? 'primary' : 'quiet'}
          aria-pressed={!showAll}
          onClick={() => onChange(false)}
        >
          Relevant
        </Button>
        <Button
          size="sm"
          variant={showAll ? 'primary' : 'quiet'}
          aria-pressed={showAll}
          onClick={() => onChange(true)}
        >
          All
        </Button>
      </ButtonGroup>
    </div>
  );
}
