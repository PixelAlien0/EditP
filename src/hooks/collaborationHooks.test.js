import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSupabaseClient } = vi.hoisted(() => ({ getSupabaseClient: vi.fn() }));

vi.mock('../lib/supabase.js', () => ({
  isSupabaseConfigured: false,
  getSupabaseClient,
}));

import { useOnlinePresence } from './useOnlinePresence.js';
import { useTemporaryChat } from './useTemporaryChat.js';

describe('Supabase collaboration fallbacks', () => {
  beforeEach(() => getSupabaseClient.mockReset());

  it('keeps presence anonymous and unconfigured without credentials', () => {
    const { result } = renderHook(() => useOnlinePresence());
    expect(result.current).toMatchObject({ count: null, status: 'unconfigured' });
    expect(getSupabaseClient).not.toHaveBeenCalled();
  });

  it('does not connect temporary chat before it is opened', () => {
    const { result } = renderHook(() => useTemporaryChat(false));
    expect(result.current.status).toBe('unconfigured');
    expect(result.current.messages).toEqual([]);
    expect(getSupabaseClient).not.toHaveBeenCalled();
  });
});
