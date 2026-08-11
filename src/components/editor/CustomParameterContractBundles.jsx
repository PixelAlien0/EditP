import { useState } from 'react';
import { Badge, Button, SelectField } from '../ui.jsx';
import {
  CUSTOM_PARAMETER_BUNDLES,
  buildCustomParameterBundleDisablePatch,
  buildCustomParameterBundleProfilePatch,
  buildCustomParameterBundleResetPatch,
  getCustomParameterBundleState,
} from '../../config/customParameterBundles.js';
import { evaluateGadgetContracts } from '../../utils/gadgetContractValidation.js';

const STATUS = Object.freeze({
  ready: Object.freeze({ label: 'Ready', tone: 'success' }),
  incomplete: Object.freeze({ label: 'Incomplete', tone: 'warning' }),
  conflicting: Object.freeze({ label: 'Conflicting', tone: 'danger' }),
  experimental: Object.freeze({ label: 'Experimental', tone: 'warning' }),
  unknown: Object.freeze({ label: 'Review', tone: 'neutral' }),
  inactive: Object.freeze({ label: 'Not configured', tone: 'neutral' }),
});

function ContractBundleCard({ entry, defaults, tweaks, onApplyPatch }) {
  const [profileId, setProfileId] = useState(entry.defaultProfileId);
  const state = getCustomParameterBundleState(entry, defaults, tweaks);
  const validation = evaluateGadgetContracts({ unitId: 'bundle-preview', defaults, patch: tweaks })
    .find(result => result.contractId === entry.contractId);
  const statusId = state.status === 'inactive' ? 'inactive' : validation?.status || 'incomplete';
  const status = STATUS[statusId];
  const selectedProfile = entry.profiles.find(profile => profile.id === profileId) || entry.profiles[0];
  const sourceLabel = entry.source.path.split('/').at(-1);

  return (
    <article className={`contract-bundle-card is-${statusId}`}>
      <header className="contract-bundle-card__header">
        <div>
          <span>{entry.eyebrow}</span>
          <h4>{entry.label}</h4>
        </div>
        <Badge tone={status.tone} size="sm" title={validation?.problems.map(problem => problem.message).join('\n')}>{status.label}</Badge>
      </header>
      <p>{entry.description}</p>
      <SelectField
        label="Starter profile"
        description={selectedProfile.description}
        value={profileId}
        onChange={event => setProfileId(event.target.value)}
      >
        {entry.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
      </SelectField>
      <div className="contract-bundle-card__facts" aria-label={`${entry.label} field coverage`}>
        <span><strong>{state.configuredCount}</strong> / {state.totalCount} configured</span>
        <span><strong>{state.modifiedCount}</strong> local overrides</span>
        <span title={entry.source.path}>{sourceLabel}</span>
      </div>
      <footer className="contract-bundle-card__actions">
        <Button
          variant="secondary"
          onClick={() => onApplyPatch(buildCustomParameterBundleProfilePatch(entry.id, profileId))}
        >
          {state.status === 'inactive' ? 'Apply bundle' : 'Apply profile'}
        </Button>
        {entry.disablePatch && state.status !== 'inactive' && (
          <Button variant="quiet" onClick={() => onApplyPatch(buildCustomParameterBundleDisablePatch(entry.id))}>Disable</Button>
        )}
        <Button
          variant="quiet"
          disabled={state.modifiedCount === 0}
          onClick={() => onApplyPatch(buildCustomParameterBundleResetPatch(entry.id))}
        >
          Restore inherited
        </Button>
      </footer>
    </article>
  );
}

export default function CustomParameterContractBundles({ defaults = {}, tweaks = {}, onApplyPatch }) {
  return (
    <section className="custom-parameter-bundles" aria-labelledby="custom-parameter-bundles-title">
      <header className="custom-parameter-bundles__header">
        <div>
          <span>Complete runtime setups</span>
          <h4 id="custom-parameter-bundles-title">Contract bundles</h4>
          <p>Apply related BAR custom parameters as one validated change, then fine-tune them in their parameter editors.</p>
        </div>
        <Badge size="sm">{CUSTOM_PARAMETER_BUNDLES.length} bundles</Badge>
      </header>
      <div className="custom-parameter-bundles__grid">
        {CUSTOM_PARAMETER_BUNDLES.map(entry => (
          <ContractBundleCard
            key={entry.id}
            entry={entry}
            defaults={defaults}
            tweaks={tweaks}
            onApplyPatch={onApplyPatch}
          />
        ))}
      </div>
    </section>
  );
}
