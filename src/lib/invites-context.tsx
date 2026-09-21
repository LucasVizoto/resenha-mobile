import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, supabaseConfigured } from './supabase';
import { useAuth } from './auth';
import { useDialog } from '../soft-ui/components/SoftDialog';
import {
  displayNameFor,
  listIncomingInvites,
  listOutgoingPending,
  respondToInvite,
} from './invites';
import type { ContactInvite } from '../types/invite';

type InvitesApi = {
  incoming: ContactInvite[];
  outgoingPendingIds: string[];
  loading: boolean;
  refresh: () => Promise<void>;
  accept: (inviteId: string) => Promise<void>;
  decline: (inviteId: string) => Promise<void>;
};

const InvitesContext = createContext<InvitesApi | undefined>(undefined);

export function InvitesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { show } = useDialog();
  const [incoming, setIncoming] = useState<ContactInvite[]>([]);
  const [outgoingPendingIds, setOutgoingPendingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const knownIds = useRef(new Set<string>());
  const ready = useRef(false);

  const refresh = useCallback(async () => {
    if (!user || !supabaseConfigured) {
      setIncoming([]);
      setOutgoingPendingIds([]);
      return;
    }
    setLoading(true);
    try {
      const [inbox, sent] = await Promise.all([
        listIncomingInvites(user.id),
        listOutgoingPending(user.id),
      ]);
      setIncoming(inbox);
      setOutgoingPendingIds(sent.map((i) => i.to_id));
      knownIds.current = new Set(inbox.map((i) => i.id));
    } catch {
      // tabela ainda pode não existir
    } finally {
      setLoading(false);
      ready.current = true;
    }
  }, [user]);

  useEffect(() => {
    ready.current = false;
    knownIds.current = new Set();
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user || !supabaseConfigured) return;
    const channel = supabase
      .channel(`contact-invites-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contact_invites' },
        () => {
          void (async () => {
            try {
              const inbox = await listIncomingInvites(user.id);
              const fresh = inbox.filter((i) => !knownIds.current.has(i.id));
              setIncoming(inbox);
              if (ready.current && fresh.length > 0) {
                const invite = fresh[0];
                const name = displayNameFor(invite.from_profile);
                show({
                  title: 'Novo convite',
                  message: `${name} deseja adicionar você à lista de contatos.`,
                  actions: [
                    {
                      label: 'Aceitar',
                      onPress: () => respondToInvite(invite.id, 'accepted').then(() => refresh()),
                    },
                    {
                      label: 'Recusar',
                      variant: 'danger',
                      onPress: () => respondToInvite(invite.id, 'declined').then(() => refresh()),
                    },
                    { label: 'Depois', variant: 'ghost' },
                  ],
                });
              }
              knownIds.current = new Set(inbox.map((i) => i.id));
              const sent = await listOutgoingPending(user.id);
              setOutgoingPendingIds(sent.map((i) => i.to_id));
            } catch {
              // ignore
            }
          })();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, refresh, show]);

  const accept = useCallback(
    async (inviteId: string) => {
      await respondToInvite(inviteId, 'accepted');
      await refresh();
    },
    [refresh],
  );

  const decline = useCallback(
    async (inviteId: string) => {
      await respondToInvite(inviteId, 'declined');
      await refresh();
    },
    [refresh],
  );

  const value = useMemo<InvitesApi>(
    () => ({ incoming, outgoingPendingIds, loading, refresh, accept, decline }),
    [incoming, outgoingPendingIds, loading, refresh, accept, decline],
  );

  return <InvitesContext.Provider value={value}>{children}</InvitesContext.Provider>;
}

export function useInvites() {
  const ctx = useContext(InvitesContext);
  if (!ctx) throw new Error('useInvites deve ser usado dentro de InvitesProvider');
  return ctx;
}
