import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ResenhaIconOption } from '../types/resenha';

function keyFor(userId: string) {
  return `resenha-custom-icons:${userId}`;
}

export async function listCustomIcons(userId: string): Promise<ResenhaIconOption[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ResenhaIconOption[];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id && item?.emoji && item?.label) : [];
  } catch {
    return [];
  }
}

export async function addCustomIcon(
  userId: string,
  emoji: string,
  label: string,
): Promise<ResenhaIconOption> {
  const cleanEmoji = emoji.trim();
  const cleanLabel = label.trim();
  if (!cleanEmoji) {
    throw new Error('Informe um emoji para o ícone.');
  }
  if (cleanLabel.length < 2) {
    throw new Error('Dê um nome para o ícone (mín. 2 letras).');
  }
  const item: ResenhaIconOption = {
    id: `custom_${Date.now().toString(36)}`,
    emoji: cleanEmoji,
    label: cleanLabel.slice(0, 24),
  };
  const current = await listCustomIcons(userId);
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify([item, ...current].slice(0, 40)));
  return item;
}
