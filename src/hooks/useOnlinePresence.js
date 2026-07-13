import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

const PRESENCE_CHANNEL = 'editp-online';
const BROWSER_ID_KEY = 'editp_presence_browser_id';

function getAnonymousBrowserId() {
  try {
    const storedId = localStorage.getItem(BROWSER_ID_KEY);
    if (storedId) return storedId;
    const generatedId = globalThis.crypto?.randomUUID?.()
      || `browser-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(BROWSER_ID_KEY, generatedId);
    return generatedId;
  } catch {
    return globalThis.crypto?.randomUUID?.()
      || `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function useOnlinePresence() {
  const [presence, setPresence] = useState({
    count: null,
    status: isSupabaseConfigured ? 'connecting' : 'unconfigured',
  });

  useEffect(() => {
    if (!supabase) return undefined;

    let disposed = false;
    const browserId = getAnonymousBrowserId();
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: browserId } },
    });

    const syncPresence = () => {
      if (disposed) return;
      const state = channel.presenceState();
      const uniqueBrowsers = Object.values(state)
        .filter(entries => Array.isArray(entries) && entries.length > 0)
        .length;
      setPresence({ count: Math.max(1, uniqueBrowsers), status: 'connected' });
    };

    channel
      .on('presence', { event: 'sync' }, syncPresence)
      .subscribe(async status => {
        if (disposed) return;
        if (status === 'SUBSCRIBED') {
          await channel.track({ onlineAt: new Date().toISOString() });
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setPresence({ count: null, status: 'unavailable' });
        }
      });

    return () => {
      disposed = true;
      void channel.untrack().finally(() => supabase.removeChannel(channel));
    };
  }, []);

  return presence;
}
