import { useMemo, useState } from 'react';
import { buildByteBudgetReport } from '../utils/byteBudget.js';
import { Tabs } from './ui.jsx';

const INSPECTOR_TABS = [
  { id: 'slots', label: 'Slots' },
  { id: 'contributors', label: 'Contributors' },
  { id: 'actions', label: 'Actions' },
];

const STATUS_LABELS = {
  blocked: 'Blocked',
  advisory: 'Size advisory',
  attention: 'Watch budget',
  healthy: 'Healthy',
};

function SlotRows({ report }) {
  if (!report.slots.length) {
    return <div className="validation-row"><span>No populated fields</span><code>0 / 18 slots</code><strong>No encoded output</strong></div>;
  }
  return report.slots.map(slot => (
    <div
      key={slot.fieldName}
      className={`validation-row ${slot.status === 'advisory' ? 'error' : slot.status === 'near' ? 'warning' : ''}`}
    >
      <span>{slot.fieldName}</span>
      <code>{slot.executionBlockCount} executed · {slot.utilization.toFixed(0)}%</code>
      <strong>
        {slot.encodedBytes.toLocaleString()} chars · {slot.advisoryHeadroom >= 0
          ? `${slot.advisoryHeadroom.toLocaleString()} advisory headroom`
          : `${Math.abs(slot.advisoryHeadroom).toLocaleString()} over advisory`}
      </strong>
    </div>
  ));
}

function ContributorRows({ report }) {
  if (!report.contributors.length) {
    return <div className="validation-row"><span>No compiler blocks</span><code>—</code><strong>Nothing contributes to the package yet</strong></div>;
  }
  return report.contributors.slice(0, 12).map(contributor => (
    <div
      key={contributor.id}
      className={`validation-row ${contributor.exceedsTarget ? 'warning' : ''}`}
    >
      <span>{contributor.label}</span>
      <code>{contributor.slotFieldName || 'overflow / unpacked'} · {contributor.source}</code>
      <strong>{contributor.estimatedEncodedBytes.toLocaleString()} estimated encoded chars</strong>
    </div>
  ));
}

function ActionRows({ report }) {
  return report.suggestions.map((suggestion, index) => (
    <div
      key={`${suggestion.title}-${index}`}
      className={`validation-row ${suggestion.level === 'error' ? 'error' : suggestion.level === 'warning' ? 'warning' : ''}`}
    >
      <span>{suggestion.level === 'error' ? 'Required' : suggestion.level === 'warning' ? 'Recommended' : 'Information'}</span>
      <code>{suggestion.title}</code>
      <strong>{suggestion.detail}</strong>
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

  return (
    <details className="export-console-config" open>
      <summary>
        <span>Byte Budget Inspector</span>
        <small>{STATUS_LABELS[report.status]} · {report.aggregate.slotsRequired} / {report.aggregate.maximumSlots} fields</small>
      </summary>
      <div className="legacy-compiler-panel__body">
        <div className="lobby-slot-capacity" aria-label="Encoded byte budget summary">
          <div style={{ '--slot-capacity': `${report.aggregate.utilization}%` }}>
            <span>Complete package</span>
            <strong>{report.aggregate.encodedBytes.toLocaleString()} chars</strong>
            <i aria-hidden="true"><b /></i>
          </div>
          <div style={{ '--slot-capacity': `${largestSlot?.utilization || 0}%` }}>
            <span>Largest populated field</span>
            <strong>{largestSlot ? `${largestSlot.fieldName} · ${largestSlot.encodedBytes.toLocaleString()}` : 'No output'}</strong>
            <i aria-hidden="true"><b /></i>
          </div>
          <div style={{ '--slot-capacity': `${(report.lanes[0]?.required / report.lanes[0]?.maximum) * 100 || 0}%` }} className={report.lanes[0]?.overflow ? 'is-overflow' : ''}>
            <span>Definitions lane</span>
            <strong>{report.lanes[0]?.required || 0} / {report.lanes[0]?.maximum || 9}</strong>
            <i aria-hidden="true"><b /></i>
          </div>
          <div style={{ '--slot-capacity': `${(report.lanes[1]?.required / report.lanes[1]?.maximum) * 100 || 0}%` }} className={report.lanes[1]?.overflow ? 'is-overflow' : ''}>
            <span>Units lane</span>
            <strong>{report.lanes[1]?.required || 0} / {report.lanes[1]?.maximum || 9}</strong>
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
        <div className="validation-list" aria-live="polite">
          {activeView === 'slots' && <SlotRows report={report} />}
          {activeView === 'contributors' && <ContributorRows report={report} />}
          {activeView === 'actions' && <ActionRows report={report} />}
        </div>
        <p>
          Generated slots target {report.options.targetBytes.toLocaleString()} encoded characters. The {report.options.advisoryBytes.toLocaleString()}-character figure is a legacy advisory, not an official BAR hard limit.
          {deduplication?.removedBlockCount > 0
            ? ` Exact safe deduplication currently saves ${deduplication.encodedBytesSaved.toLocaleString()} characters (${dedupPercent.toFixed(1)}%).`
            : ' No byte-identical compiler blocks are currently eligible for safe deduplication.'}
          {compaction?.appliedSlotCount > 0
            ? ` Equivalence-guarded compaction saves another ${compaction.encodedBytesSaved.toLocaleString()} characters across ${compaction.appliedSlotCount} generated ${compaction.appliedSlotCount === 1 ? 'slot' : 'slots'}.`
            : ''}
        </p>
      </div>
    </details>
  );
}
