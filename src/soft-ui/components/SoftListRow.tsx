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
  unreadCount?: number;
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
  unreadCount = 0,
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
          <Text
            style={[
              theme.typography.bodyMedium,
              {
                color: theme.colors.textPrimary,
                fontWeight: unreadCount > 0 ? '700' : theme.typography.bodyMedium.fontWeight,
              },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[
                theme.typography.caption,
                {
                  color: unreadCount > 0 ? theme.colors.textPrimary : theme.colors.textSecondary,
                  marginTop: 4,
                  fontWeight: unreadCount > 0 ? '600' : '400',
                },
              ]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {unreadCount > 0 ? (
          <View style={[styles.unread, { backgroundColor: theme.colors.brand.solid }]}>
            <Text style={[styles.unreadText, { color: theme.colors.textOnBrand }]}>
              {unreadCount > 99 ? '99+' : String(unreadCount)}
            </Text>
          </View>
        ) : null}
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
  unread: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    marginTop: 12,
  },
});
