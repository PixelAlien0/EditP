import { useMemo, useState } from 'react';
import { buildByteBudgetReport } from '../utils/byteBudget.js';
import { Tabs } from './ui.jsx';

const INSPECTOR_TABS = [
  { id: 'slots', label: 'Fields' },
  { id: 'contributors', label: 'Contributors' },
  { id: 'actions', label: 'Guidance' },
];

const STATUS_LABELS = {
  blocked: 'Blocked',
  attention: 'Watch budget',
  healthy: 'Healthy',
};

function SlotRows({ report }) {
  if (!report.slots.length) {
    return <div className="budget-inspector-empty"><strong>No populated fields</strong><span>The current project does not produce encoded lobby output.</span></div>;
  }

  return report.slots.map(slot => (
    <div key={slot.fieldName} className={`budget-inspector-row is-${slot.status}`}>
      <div className="budget-inspector-row__identity">
        <strong>{slot.fieldName}</strong>
        <span>{slot.executionBlockCount} executed {slot.executionBlockCount === 1 ? 'block' : 'blocks'}</span>
      </div>
      <div className="budget-inspector-row__usage">
        <span><strong>{slot.encodedBytes.toLocaleString()}</strong> chars</span>
        <span>{slot.limitHeadroom >= 0
          ? `${slot.limitHeadroom.toLocaleString()} remaining`
          : `${Math.abs(slot.limitHeadroom).toLocaleString()} over limit`}</span>
      </div>
      <div
        className="budget-inspector-row__meter"
        style={{ '--budget-use': `${slot.utilization}%` }}
        aria-label={`${slot.utilization.toFixed(0)} percent of field limit used`}
      >
        <i aria-hidden="true"><b /></i>
        <small>{slot.utilization.toFixed(0)}%</small>
      </div>
    </div>
  ));
}

function ContributorRows({ report }) {
  if (!report.contributors.length) {
    return <div className="budget-inspector-empty"><strong>No compiler blocks</strong><span>Nothing contributes to the package yet.</span></div>;
  }

  return report.contributors.slice(0, 12).map(contributor => (
    <div
      key={contributor.id}
      className={`budget-inspector-row budget-inspector-row--contributor ${contributor.exceedsTarget ? 'is-near' : ''}`}
    >
      <div className="budget-inspector-row__identity">
        <strong>{contributor.label}</strong>
        <span>{contributor.source} source</span>
      </div>
      <code>{contributor.slotFieldName || 'Overflow / unpacked'}</code>
      <div className="budget-inspector-row__usage">
        <span><strong>{contributor.estimatedEncodedBytes.toLocaleString()}</strong> estimated chars</span>
        <span>{contributor.duplicateCount ? `${contributor.duplicateCount} duplicate references` : 'Independent block'}</span>
      </div>
    </div>
  ));
}

function ActionRows({ report }) {
  return report.suggestions.map((suggestion, index) => (
    <div key={`${suggestion.title}-${index}`} className={`budget-inspector-advice is-${suggestion.level}`}>
      <span>{suggestion.level === 'error' ? 'Required' : suggestion.level === 'warning' ? 'Recommended' : 'Information'}</span>
      <div><strong>{suggestion.title}</strong><p>{suggestion.detail}</p></div>
    </div>
  ));
}

export default function ByteBudgetInspector({ compiledModules }) {
  const [activeView, setActiveView] = useState('slots');
  const report = useMemo(
    () => buildByteBudgetReport(compiledModules),
    [compiledModules],
  );
  const largestSlot = [...report.slots]
    .sort((left, right) => right.encodedBytes - left.encodedBytes || left.fieldName.localeCompare(right.fieldName))[0];
  const deduplication = report.deduplication;
  const compaction = report.compaction;
  const dedupBeforeBytes = deduplication?.before?.encodedBytes || 0;
  const dedupPercent = dedupBeforeBytes
    ? Math.min(100, ((deduplication?.encodedBytesSaved || 0) / dedupBeforeBytes) * 100)
    : 0;
  const statusDetail = report.status === 'blocked'
    ? 'Output exceeds a delivery constraint'
    : report.status === 'attention'
      ? 'One or more fields are nearing capacity'
      : 'All generated fields have safe headroom';

  return (
    <details className={`export-console-config export-inspector export-inspector--budget is-${report.status}`}>
      <summary className="export-inspector__summary">
        <span className="export-inspector__index" aria-hidden="true">B</span>
        <span className="export-inspector__heading">
          <small>Delivery capacity</small>
          <strong>Byte Budget Inspector</strong>
          <em>{statusDetail}</em>
        </span>
        <span className={`export-inspector__status is-${report.status}`}>{STATUS_LABELS[report.status]}</span>
        <span className="export-inspector__metrics" aria-label="Byte budget summary">
          <span><small>Fields</small><strong>{report.aggregate.slotsRequired} / {report.aggregate.maximumSlots}</strong></span>
          <span><small>Payload</small><strong>{report.aggregate.encodedBytes.toLocaleString()}</strong></span>
        </span>
      </summary>

      <div className="export-inspector__body byte-budget-inspector__body">
        <div className="byte-budget-overview" aria-label="Encoded byte budget summary">
          <div style={{ '--slot-capacity': `${report.aggregate.utilization}%` }}>
            <span><small>Complete package</small><strong>{report.aggregate.encodedBytes.toLocaleString()} chars</strong></span>
            <em>{report.aggregate.utilization.toFixed(0)}% of total capacity</em>
            <i aria-hidden="true"><b /></i>
          </div>
          <div style={{ '--slot-capacity': `${largestSlot?.utilization || 0}%` }}>
            <span><small>Largest field</small><strong>{largestSlot?.fieldName || 'No output'}</strong></span>
            <em>{largestSlot ? `${largestSlot.encodedBytes.toLocaleString()} chars` : 'No populated fields'}</em>
            <i aria-hidden="true"><b /></i>
          </div>
          <div style={{ '--slot-capacity': `${(report.lanes[0]?.required / report.lanes[0]?.maximum) * 100 || 0}%` }} className={report.lanes[0]?.overflow ? 'is-overflow' : ''}>
            <span><small>Definitions</small><strong>{report.lanes[0]?.required || 0} / {report.lanes[0]?.maximum || 9} fields</strong></span>
            <em>{report.lanes[0]?.remainingSlots || 0} free</em>
            <i aria-hidden="true"><b /></i>
          </div>
          <div style={{ '--slot-capacity': `${(report.lanes[1]?.required / report.lanes[1]?.maximum) * 100 || 0}%` }} className={report.lanes[1]?.overflow ? 'is-overflow' : ''}>
            <span><small>Units</small><strong>{report.lanes[1]?.required || 0} / {report.lanes[1]?.maximum || 9} fields</strong></span>
            <em>{report.lanes[1]?.remainingSlots || 0} free</em>
            <i aria-hidden="true"><b /></i>
          </div>
        </div>

        <Tabs
          className="export-output-tabs"
          size="sm"
          label="Byte budget inspection view"
          items={INSPECTOR_TABS}
          value={activeView}
          onChange={setActiveView}
        />
        <div className="budget-inspector-list" aria-live="polite">
          {activeView === 'slots' && <SlotRows report={report} />}
          {activeView === 'contributors' && <ContributorRows report={report} />}
          {activeView === 'actions' && <ActionRows report={report} />}
        </div>
        <p className="export-inspector__note">
          Generated fields target {report.options.targetBytes.toLocaleString()} encoded characters and preserve a safety reserve below the enforced {report.options.limitBytes.toLocaleString()}-character multiplayer limit.
          {deduplication?.removedBlockCount > 0
            ? ` Safe deduplication currently saves ${deduplication.encodedBytesSaved.toLocaleString()} characters (${dedupPercent.toFixed(1)}%).`
            : ' No byte-identical compiler blocks are currently eligible for safe deduplication.'}
          {compaction?.appliedSlotCount > 0
            ? ` Equivalence-guarded compaction saves another ${compaction.encodedBytesSaved.toLocaleString()} characters across ${compaction.appliedSlotCount} generated ${compaction.appliedSlotCount === 1 ? 'field' : 'fields'}.`
            : ''} Imported modules remain unchanged; an atomic module above the limit blocks export rather than being truncated.
        </p>
      </div>
    </details>
  );
}
