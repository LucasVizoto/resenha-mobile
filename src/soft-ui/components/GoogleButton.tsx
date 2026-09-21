import React from 'react';
import { Pressable, Text, View, StyleSheet, ViewStyle } from 'react-native';
import type { AppTheme } from '../theme';

type Props = {
  theme: AppTheme;
  onPress?: () => void;
  label?: string;
  style?: ViewStyle;
  disabled?: boolean;
};

/** Botão Google outlined — pílula com borda, no padrão do mockup. */
export function GoogleButton({
  theme,
  onPress,
  label = 'Continuar com o Google',
  style,
  disabled,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        theme.shadows.soft,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.pill,
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
          opacity: disabled ? 0.55 : pressed ? 0.9 : 1,
        },
        style,
      ]}
    >
      <View style={styles.gBadge}>
        <Text style={styles.gLetter}>G</Text>
      </View>
      <Text style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  gBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gLetter: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EA4335',
  },
});
