import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase.js';
import { getBrowserIdentity } from '../lib/browserIdentity.js';
import {
  createPresenceActivityCounts,
  normalizePresenceActivity,
  PRESENCE_ACTIVITY,
  summarizePresenceState
} from '../config/presenceActivities.js';

const PRESENCE_CHANNEL = 'editp-online';

export function useOnlinePresence(activity = PRESENCE_ACTIVITY.EDIT_UNITS) {
  const normalizedActivity = normalizePresenceActivity(activity);
  const [presence, setPresence] = useState({
    count: null,
    activityCounts: createPresenceActivityCounts(),
    status: isSupabaseConfigured ? 'connecting' : 'unconfigured'
  });
  const channelRef = useRef(null);
  const subscribedRef = useRef(false);
  const activityRef = useRef(normalizedActivity);
  const connectedAtRef = useRef(new Date().toISOString());
  const browserIdRef = useRef(null);

  const createTrackingPayload = useCallback(() => ({
    browserId: browserIdRef.current,
    activity: activityRef.current,
    onlineAt: connectedAtRef.current,
    activityUpdatedAt: new Date().toISOString()
  }), []);

  useEffect(() => {
    activityRef.current = normalizedActivity;
    if (channelRef.current && subscribedRef.current) {
      void channelRef.current.track(createTrackingPayload());
    }
  }, [normalizedActivity, createTrackingPayload]);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    let disposed = false;
    let client = null;
    let channel = null;
    browserIdRef.current = getBrowserIdentity().id;

    void getSupabaseClient().then(supabase => {
      if (disposed || !supabase) return;
      client = supabase;
      channel = supabase.channel(PRESENCE_CHANNEL, {
        config: { presence: { key: browserIdRef.current } }
      });
      channelRef.current = channel;

      const syncPresence = () => {
        if (disposed) return;
        const summary = summarizePresenceState(channel.presenceState());

        if (summary.count === 0) {
          summary.count = 1;
          summary.activityCounts[activityRef.current] = 1;
        }

        setPresence({ ...summary, status: 'connected' });
      };

      channel
        .on('presence', { event: 'sync' }, syncPresence)
        .subscribe(async status => {
          if (disposed) return;
          if (status === 'SUBSCRIBED') {
            subscribedRef.current = true;
            await channel.track(createTrackingPayload());
            return;
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            subscribedRef.current = false;
            setPresence({
              count: null,
              activityCounts: createPresenceActivityCounts(),
              status: 'unavailable'
            });
          }
        });
    }).catch(() => {
      if (!disposed) setPresence(current => ({ ...current, status: 'unavailable' }));
    });

    return () => {
      disposed = true;
      subscribedRef.current = false;
      channelRef.current = null;
      if (channel && client) void channel.untrack().finally(() => client.removeChannel(channel));
    };
  }, [createTrackingPayload]);

  return presence;
}
