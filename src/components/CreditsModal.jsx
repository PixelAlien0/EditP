import { useRef } from 'react';
import UnitArtwork from './UnitArtwork.jsx';
import { Button, Dialog, IconButton } from './ui.jsx';

const CREDIT_SOURCES = [
  {
    kind: 'Game data',
    name: 'Beyond All Reason',
    description: 'Unit definitions, weapon definitions, internal IDs, balance defaults, and build-picture references used by the editor.',
    href: 'https://github.com/beyond-all-reason/Beyond-All-Reason'
  },
  {
    kind: 'Unit artwork',
    name: 'BAR unitpics',
    description: 'The unit thumbnails shown throughout the library are web conversions of build pictures from the BAR game repository.',
    href: 'https://github.com/beyond-all-reason/Beyond-All-Reason/tree/master/unitpics'
  },
  {
    kind: 'Engine behavior',
    name: 'Recoil Engine',
    description: 'Weapon and unit fields ultimately follow the engine behavior implemented by Recoil and its Spring engine heritage.',
    href: 'https://github.com/beyond-all-reason/RecoilEngine'
  },
  {
    kind: 'Effects reference',
    name: 'Spring CEG documentation',
    description: 'Custom explosion generator terminology and effect properties are informed by the public Spring CEG reference.',
    href: 'https://springrts.com/wiki/CEG%3ADefs'
  },
  {
    kind: 'Official game',
    name: 'Beyond All Reason website',
    description: 'Game downloads, community links, news, and the official presentation of Beyond All Reason.',
    href: 'https://www.beyondallreason.info/'
  }
];

const CREDIT_NOTICES = [
  {
    title: 'Independent fan project',
    copy: 'BAR Editor is an independently developed modding companion. It is not affiliated with, authorized by, or endorsed by the Beyond All Reason team, the Recoil/Spring contributors, or the owners of any underlying game properties.'
  },
  {
    title: 'Ownership stays upstream',
    copy: 'Names, logos, unit artwork, game data, sounds, and other third-party material remain the property of their respective creators and rights holders. Their appearance here is attribution, not a transfer of ownership.'
  },
  {
    title: 'Licenses vary by asset',
    copy: 'BAR contains material under multiple licenses and folder-specific notices. This editor does not relicense those assets. Check the current upstream license and attribution files before redistributing a mod or any bundled media.'
  },
  {
    title: 'Generated output needs testing',
    copy: 'Generated Lua and project files are editing aids, not a guarantee of balance, engine compatibility, multiplayer safety, or acceptance by BAR. Test changes in an isolated development environment before release.'
  },
  {
    title: 'Game updates can drift',
    copy: 'The editor uses a bundled snapshot of public definitions. BAR and Recoil evolve continuously, so field behavior, defaults, and available assets may differ from the version currently installed on a player’s machine.'
  },
  {
    title: 'Your project stays local',
    copy: 'Editor drafts use browser storage, and Save Project creates a local file. The editor does not publish a project for you; sharing an export or generated mod remains an intentional user action.'
  }
];

const CREDIT_IMAGE_PREVIEWS = [
  { id: 'armcom', alt: 'Armada commander unit artwork' },
  { id: 'corcom', alt: 'Cortex commander unit artwork' },
  { id: 'legcom', alt: 'Legion commander unit artwork' },
  { id: 'armdfly', alt: 'Armada unit artwork' }
];

export default function CreditsModal({ onClose }) {
  const closeButtonRef = useRef(null);
  return (
    <Dialog
      onClose={onClose}
      initialFocusRef={closeButtonRef}
      overlayClassName="credits-overlay"
      className="credits-modal"
      labelledBy="credits-modal-title"
      describedBy="credits-modal-summary"
    >
      <header className="credits-modal__header">
        <div>
          <span className="credits-modal__eyebrow">Project information</span>
          <h2 id="credits-modal-title">Disclaimer &amp; credits</h2>
        </div>
        <IconButton ref={closeButtonRef} variant="quiet" className="credits-modal__close" onClick={onClose} label="Close disclaimer and credits">
          <span aria-hidden="true">×</span>
        </IconButton>
      </header>

      <div className="credits-modal__body">
        <section className="credits-intro" aria-labelledby="credits-intro-title">
          <img src="/logo.svg" alt="" className="credits-intro__logo" />
          <div>
            <span className="credits-intro__status">Independent fan-made editor</span>
            <h3 id="credits-intro-title">Built for experimenting with BAR definitions</h3>
            <p id="credits-modal-summary">BAR Editor helps creators inspect, adjust, clone, and export game definitions. It is a community tool and is separate from the official Beyond All Reason project.</p>
          </div>
        </section>

        <section className="credits-notice" aria-labelledby="credits-important-title">
          <div className="credits-section-heading">
            <span>Read before publishing</span>
            <h3 id="credits-important-title">Important use notes</h3>
          </div>
          <div className="credits-notice__grid">
            {CREDIT_NOTICES.map((notice, index) => (
              <article key={notice.title} className="credits-notice__item">
                <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h4>{notice.title}</h4>
                  <p>{notice.copy}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="credits-assets" aria-labelledby="credits-assets-title">
          <div className="credits-assets__previews" aria-label="Examples of credited BAR unit artwork">
            {CREDIT_IMAGE_PREVIEWS.map(image => <UnitArtwork key={image.id} unitId={image.id} alt={image.alt} />)}
          </div>
          <div className="credits-assets__copy">
            <span>Image provenance</span>
            <h3 id="credits-assets-title">Unit imagery comes from BAR build pictures</h3>
            <p>Images in the unit library are converted for browser display from the BAR repository’s <code>unitpics</code> assets. Sound parameters only reference engine asset names; the editor does not package or redistribute BAR sound files.</p>
          </div>
        </section>

        <section className="credits-sources" aria-labelledby="credits-sources-title">
          <div className="credits-section-heading">
            <span>Primary references</span>
            <h3 id="credits-sources-title">Sources &amp; acknowledgements</h3>
            <p>Follow the original projects for current code, documentation, licenses, and contributor history.</p>
          </div>
          <div className="credits-sources__grid">
            {CREDIT_SOURCES.map(source => (
              <a key={source.name} className="credits-source-card" href={source.href} target="_blank" rel="noreferrer">
                <span>{source.kind}</span>
                <strong>{source.name}</strong>
                <p>{source.description}</p>
                <small>Open source ↗</small>
              </a>
            ))}
          </div>
        </section>

        <footer className="credits-modal__footer">
          <div className="credits-maintainer">
            <span>Web application</span>
            <strong>Maintained by [Grump]SunlessK</strong>
          </div>
          <Button onClick={onClose}>Done</Button>
        </footer>
      </div>
    </Dialog>
  );
}
