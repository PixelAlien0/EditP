import { useEffect, useRef, useState } from 'react';
import { getSoundAudioUrls, loadAssetPreviewCatalog } from '../../utils/barAssets.js';

export default function SoundPreviewButton({ soundName, compact = false, className = '' }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const audioRef = useRef(null);
  const playbackAttemptRef = useRef(0);

  useEffect(() => {
    return () => {
      playbackAttemptRef.current += 1;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [soundName]);

  if (!soundName || !String(soundName).trim()) return null;

  const handleTogglePlay = async (e) => {
    e.stopPropagation();
    if (isPlaying || isLoading) {
      playbackAttemptRef.current += 1;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setHasError(false);
    const attempt = playbackAttemptRef.current + 1;
    playbackAttemptRef.current = attempt;

    try {
      await loadAssetPreviewCatalog('sound');
    } catch {
      // Candidate URLs below still allow playback when the manifest cannot load.
    }
    if (playbackAttemptRef.current !== attempt) return;

    const urls = getSoundAudioUrls(soundName);
    if (!urls.length) {
      setIsLoading(false);
      setHasError(true);
      return;
    }

    let urlIndex = 0;

    const playNext = () => {
      if (urlIndex >= urls.length) {
        if (playbackAttemptRef.current !== attempt) return;
        setIsLoading(false);
        setIsPlaying(false);
        setHasError(true);
        audioRef.current = null;
        return;
      }

      const audio = new Audio(urls[urlIndex]);
      audioRef.current = audio;

      audio.oncanplay = () => {
        if (playbackAttemptRef.current !== attempt) return;
        setIsLoading(false);
        setIsPlaying(true);
        audio.play().catch(() => {
          urlIndex += 1;
          playNext();
        });
      };

      audio.onended = () => {
        if (playbackAttemptRef.current !== attempt) return;
        setIsPlaying(false);
        setIsLoading(false);
        audioRef.current = null;
      };

      audio.onerror = () => {
        if (playbackAttemptRef.current !== attempt) return;
        urlIndex += 1;
        playNext();
      };
    };

    playNext();
  };

  const label = isPlaying
    ? `Stop preview for ${soundName}`
    : isLoading
      ? `Loading audio for ${soundName}...`
      : hasError
        ? `Retry sound preview for ${soundName}`
        : `Play sound preview for ${soundName}`;

  return (
    <button
      type="button"
      className={`sound-preview-btn ${isPlaying ? 'is-playing' : ''} ${isLoading ? 'is-loading' : ''} ${hasError ? 'has-error' : ''} ${compact ? 'is-compact' : ''} ${className}`}
      onClick={handleTogglePlay}
      title={hasError ? `Audio file '${soundName}' not available on CDN` : label}
      aria-label={label}
    >
      {isLoading ? (
        <span className="sound-preview-spinner" aria-hidden="true" />
      ) : isPlaying ? (
        <svg className="sound-preview-icon" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="3" y="3" width="10" height="10" rx="1.5" fill="currentColor" />
        </svg>
      ) : (
        <svg className="sound-preview-icon" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4.5 3.25v9.5l8-4.75-8-4.75z" fill="currentColor" />
        </svg>
      )}
      {!compact && <span className="sound-preview-label">{isPlaying ? 'Stop sound' : hasError ? 'Retry sound' : 'Play sound'}</span>}
    </button>
  );
}
