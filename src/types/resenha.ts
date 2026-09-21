import type { Profile } from './profile';

export type ResenhaIconOption = {
  id: string;
  emoji: string;
  label: string;
};

export type ResenhaMemberRole = 'host' | 'guest';

export type ResenhaMember = {
  user_id: string;
  role: ResenhaMemberRole;
  profile?: Profile | null;
};

export type Resenha = {
  id: string;
  host_id: string;
  name: string;
  occurs_at: string;
  icon: string;
  icon_emoji?: string | null;
  icon_label?: string | null;
  latitude: number;
  longitude: number;
  created_at?: string;
  updated_at?: string;
  members?: ResenhaMember[];
};

export const RESENHA_ICONS: ResenhaIconOption[] = [
  { id: 'soccer', emoji: '⚽', label: 'Futebol' },
  { id: 'beer', emoji: '🍺', label: 'Bar' },
  { id: 'food', emoji: '🍽️', label: 'Comida' },
  { id: 'music', emoji: '🎵', label: 'Música' },
  { id: 'game', emoji: '🎮', label: 'Game' },
  { id: 'coffee', emoji: '☕', label: 'Café' },
  { id: 'party', emoji: '🎉', label: 'Festa' },
  { id: 'basketball', emoji: '🏀', label: 'Basquete' },
  { id: 'beach', emoji: '🏖️', label: 'Praia' },
  { id: 'movie', emoji: '🎬', label: 'Filme' },
];

export function resenhaIconEmoji(icon: string, customEmoji?: string | null): string {
  if (customEmoji?.trim()) return customEmoji.trim();
  return RESENHA_ICONS.find((item) => item.id === icon)?.emoji ?? '⚽';
}

export function formatResenhaDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatResenhaDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('pt-BR', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
}
