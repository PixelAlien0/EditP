import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBrowserIdentity } from '../lib/browserIdentity.js';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

export const CHAT_RETENTION_MINUTES = 8;
export const CHAT_MAX_LENGTH = 280;
export const CHAT_SEND_COOLDOWN_MS = 3000;

const CHAT_TABLE = 'temporary_chat_messages';
const CHAT_CHANNEL = 'editp-temporary-chat';
const CHAT_RETENTION_MS = CHAT_RETENTION_MINUTES * 60 * 1000;
const LINK_PATTERN = /(?:https?:\/\/|www\.|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/:?#][^\s]*)?)/i;

function isCurrentMessage(message, now = Date.now()) {
  const createdAt = Date.parse(message?.created_at || '');
  return Number.isFinite(createdAt) && createdAt > now - CHAT_RETENTION_MS;
}

function normalizeMessage(message) {
  if (!message?.id || !message?.created_at) return null;
  return {
    id: String(message.id),
    sender_id: String(message.sender_id || ''),
    sender_name: String(message.sender_name || 'Guest'),
    body: String(message.body || ''),
    created_at: String(message.created_at),
  };
}

function mergeMessages(current, incoming) {
  const merged = new Map(current.map(message => [message.id, message]));
  incoming.forEach(rawMessage => {
    const message = normalizeMessage(rawMessage);
    if (message && isCurrentMessage(message)) merged.set(message.id, message);
  });
  return [...merged.values()]
    .filter(message => isCurrentMessage(message))
    .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))
    .slice(-50);
}

export function validateChatMessage(value) {
  const body = String(value || '').replace(/\r\n?/g, '\n').trim();
  if (!body) return { body, error: 'Write a message first.' };
  if (body.length > CHAT_MAX_LENGTH) return { body, error: `Keep messages under ${CHAT_MAX_LENGTH} characters.` };
  if (LINK_PATTERN.test(body)) return { body, error: 'Links and web addresses are not allowed.' };
  return { body, error: null };
}

export function useTemporaryChat() {
  const identity = useMemo(() => getBrowserIdentity(), []);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState(isSupabaseConfigured ? 'loading' : 'unconfigured');
  const [error, setError] = useState('');
  const lastSentAtRef = useRef(0);

  useEffect(() => {
    if (!supabase) return undefined;

    let disposed = false;
    const channel = supabase
      .channel(CHAT_CHANNEL)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: CHAT_TABLE },
        payload => {
          if (!disposed) setMessages(current => mergeMessages(current, [payload.new]));
        }
      );

    channel.subscribe(subscriptionStatus => {
      if (disposed) return;
      if (subscriptionStatus === 'SUBSCRIBED') setStatus(current => current === 'loading' ? 'connected' : current);
      if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT') {
        setStatus('unavailable');
        setError('The temporary chat connection is unavailable.');
      }
    });

    const loadMessages = async () => {
      const cutoff = new Date(Date.now() - CHAT_RETENTION_MS).toISOString();
      const { data, error: loadError } = await supabase
        .from(CHAT_TABLE)
        .select('id,sender_id,sender_name,body,created_at')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: true })
        .limit(50);

      if (disposed) return;
      if (loadError) {
        const missingTable = loadError.code === '42P01' || /temporary_chat_messages/i.test(loadError.message || '');
        setStatus(missingTable ? 'setup-required' : 'unavailable');
        setError(missingTable
          ? 'Temporary chat needs its Supabase setup script.'
          : 'Recent messages could not be loaded.');
        return;
      }

      setMessages(current => mergeMessages(current, data || []));
      setStatus('connected');
      setError('');
    };

    void loadMessages();
    const expiryTimer = window.setInterval(() => {
      if (!disposed) setMessages(current => mergeMessages(current, []));
    }, 15000);

    return () => {
      disposed = true;
      window.clearInterval(expiryTimer);
      void supabase.removeChannel(channel);
    };
  }, []);

  const sendMessage = useCallback(async value => {
    const validation = validateChatMessage(value);
    if (validation.error) throw new Error(validation.error);
    if (!supabase) throw new Error('Temporary chat is not configured.');

    const cooldownRemaining = CHAT_SEND_COOLDOWN_MS - (Date.now() - lastSentAtRef.current);
    if (cooldownRemaining > 0) throw new Error(`Wait ${Math.ceil(cooldownRemaining / 1000)}s before sending again.`);

    lastSentAtRef.current = Date.now();
    const { data, error: sendError } = await supabase
      .from(CHAT_TABLE)
      .insert({
        sender_id: identity.id,
        sender_name: identity.name,
        body: validation.body,
      })
      .select('id,sender_id,sender_name,body,created_at')
      .single();

    if (sendError) {
      lastSentAtRef.current = 0;
      if (sendError.code === '23514') throw new Error('That message contains a link or unsupported text.');
      if (sendError.code === 'P0001') throw new Error('Please wait a moment before sending again.');
      throw new Error('Message could not be sent.');
    }

    setMessages(current => mergeMessages(current, [data]));
    return data;
  }, [identity]);

  return {
    identity,
    messages,
    status,
    error,
    sendMessage,
    retentionMinutes: CHAT_RETENTION_MINUTES,
    maxLength: CHAT_MAX_LENGTH,
  };
}
