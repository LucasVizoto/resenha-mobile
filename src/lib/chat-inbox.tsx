import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from './auth';
import { countUnread } from './db/conversations';
import {
  applyIncomingRemoteMessage,
  flushUnsyncedMessages,
  pullIncomingMessages,
} from './message-sync';
import { fetchChatGroup, pullMyGroups } from './groups';
import {
  registerPushToken,
  setActiveConversationId,
  unregisterPushToken,
  watchNotificationResponses,
} from './notifications';
import { supabase, supabaseConfigured } from './supabase';

type ChatInboxApi = {
  unreadTotal: number;
  inboxTick: number;
  refresh: () => Promise<void>;
  bump: () => void;
};

const ChatInboxContext = createContext<ChatInboxApi | undefined>(undefined);

export function ChatInboxProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [inboxTick, setInboxTick] = useState(0);

  const bump = useCallback(() => {
    setInboxTick((n) => n + 1);
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      setUnreadTotal(0);
      return;
    }
    try {
      setUnreadTotal(await countUnread(user.id));
    } catch (e) {
      if (!/closed resource|NullPointerException|prepareAsync|DB não inicializado/i.test(String(e))) {
        console.warn('[Resenha] Falha ao contar não lidas', e);
      }
      setUnreadTotal(0);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) {
      setActiveConversationId(null);
      void unregisterPushToken();
      return;
    }

    let alive = true;

    void (async () => {
      await registerPushToken(user.id);
      const groups = await pullMyGroups();
      await flushUnsyncedMessages(user.id);
      const applied = await pullIncomingMessages(user.id);
      if (!alive) return;
      await refresh();
      if (applied > 0 || groups > 0) bump();
    })();

    return () => {
      alive = false;
    };
  }, [bump, refresh, user]);

  useEffect(() => {
    if (!user || !supabaseConfigured) return;
    const channel = supabase
      .channel(`chat-inbox-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          void (async () => {
            try {
              const inserted = await applyIncomingRemoteMessage(
                (payload.new ?? {}) as Record<string, unknown>,
                user.id,
                { notify: true },
              );
              if (inserted) {
                await refresh();
                bump();
              }
    } catch (e) {
      if (!/closed resource|NullPointerException|prepareAsync|DB não inicializado/i.test(String(e))) {
        console.warn('[Resenha] Falha ao aplicar mensagem', e);
      }
    }
          })();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_group_members',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          void (async () => {
            const groupId = String((payload.new as { group_id?: string } | null)?.group_id ?? '');
            if (!groupId) return;
            let group = await fetchChatGroup(groupId).catch(() => null);
            if (!group) {
              await new Promise((resolve) => setTimeout(resolve, 400));
              group = await fetchChatGroup(groupId).catch(() => null);
            }
            if (group) {
              await refresh();
              bump();
            }
          })();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_groups',
        },
        (payload) => {
          void (async () => {
            const groupId = String((payload.new as { id?: string } | null)?.id ?? '');
            if (!groupId) return;
            const group = await fetchChatGroup(groupId).catch(() => null);
            if (group) {
              await refresh();
              bump();
            }
          })();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [bump, refresh, user]);

  useEffect(() => {
    if (!user) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void (async () => {
        const applied = await pullIncomingMessages(user.id);
        const groups = await pullMyGroups();
        await flushUnsyncedMessages(user.id);
        await refresh();
        if (applied > 0 || groups > 0) bump();
      })();
    });
    return () => sub.remove();
  }, [bump, refresh, user]);

  useEffect(() => {
    if (!user || Platform.OS === 'web') return;
    return watchNotificationResponses((conversationId) => {
      setTimeout(() => {
        router.push(`/(app)/chat/${conversationId}`, { withAnchor: true });
      }, 350);
    });
  }, [user]);

  const value = useMemo(
    () => ({ unreadTotal, inboxTick, refresh, bump }),
    [bump, inboxTick, refresh, unreadTotal],
  );
  return <ChatInboxContext.Provider value={value}>{children}</ChatInboxContext.Provider>;
}

export function useChatInbox(): ChatInboxApi {
  const ctx = useContext(ChatInboxContext);
  if (!ctx) throw new Error('useChatInbox deve ser usado dentro de ChatInboxProvider');
  return ctx;
}
