import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AppTheme } from '../theme';
import { avatarAccents } from '../tokens/colors';
import { IconCamera } from './SoftIcons';

type Props = {
  theme: AppTheme;
  uri?: string | null;
  name?: string | null;
  size?: number;
  onPress?: () => void;
  uploading?: boolean;
  editable?: boolean;
};

function initials(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function accentFor(name?: string | null) {
  const s = (name ?? '?').trim() || '?';
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash + s.charCodeAt(i) * (i + 1)) % avatarAccents.length;
  }
  return avatarAccents[hash];
}

/** Avatar circular Soft UI. */
export function SoftAvatar({
  theme,
  uri,
  name,
  size = 48,
  onPress,
  uploading = false,
  editable = false,
}: Props) {
  const inner = (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: uri ? theme.colors.brand.muted : accentFor(name),
            opacity: uploading ? 0.7 : 1,
          },
        ]}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            accessibilityLabel={name ?? 'Avatar'}
          />
        ) : (
          <Text
            style={[
              theme.typography.label,
              { color: theme.colors.textOnBrand, fontSize: size * 0.34, fontWeight: '700' },
            ]}
          >
            {initials(name)}
          </Text>
        )}
      </View>
      {editable ? (
        <View
          pointerEvents="none"
          style={[
            styles.badge,
            {
              backgroundColor: theme.colors.brand.solid,
              width: size * 0.32,
              height: size * 0.32,
              borderRadius: size * 0.16,
              borderColor: theme.colors.surface,
            },
          ]}
        >
          <IconCamera color={theme.colors.textOnBrand} size={Math.max(12, size * 0.16)} />
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return inner;

  return (
    <Pressable onPress={onPress} disabled={uploading} accessibilityRole="button" accessibilityLabel="Alterar foto de perfil">
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
});
