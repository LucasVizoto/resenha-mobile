import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AppTheme } from '../theme';
import { SoftAvatar } from './SoftAvatar';

type Props = {
  theme: AppTheme;
  title: string;
  subtitle?: string | null;
  avatarUri?: string | null;
  onPress?: () => void;
  disabled?: boolean;
  right?: React.ReactNode;
  footer?: React.ReactNode;
};

export function SoftListRow({
  theme,
  title,
  subtitle,
  avatarUri,
  onPress,
  disabled,
  right,
  footer,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.wrap,
        theme.shadows.soft,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.lg,
          opacity: disabled ? 0.7 : pressed && onPress ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        <SoftAvatar theme={theme} uri={avatarUri} name={title} size={52} />
        <View style={styles.copy}>
          <Text style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[theme.typography.caption, { color: theme.colors.textSecondary, marginTop: 4 }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  copy: {
    flex: 1,
  },
  footer: {
    marginTop: 12,
  },
});
