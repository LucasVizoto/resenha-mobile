import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { AppTheme } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  theme: AppTheme;
  loading?: boolean;
  disabled?: boolean;
  size?: 'default' | 'compact';
  style?: ViewStyle;
  textStyle?: TextStyle;
};

/**
 * Botão pílula Soft UI.
 * primary = gradiente azul/ciano; secondary = surface elevada; ghost = texto.
 */
export function SoftButton({
  label,
  onPress,
  variant = 'primary',
  theme,
  loading = false,
  disabled = false,
  size = 'default',
  style,
  textStyle,
}: Props) {
  const isPrimary = variant === 'primary';
  const isGhost = variant === 'ghost';
  const isDanger = variant === 'danger';
  const isCompact = size === 'compact';
  const height = isCompact ? 48 : 56;
  const opacity = disabled || loading ? 0.55 : 1;

  const content = loading ? (
    <ActivityIndicator
      color={
        isPrimary
          ? theme.colors.textOnBrand
          : isDanger
            ? theme.colors.danger
            : theme.colors.brand.solid
      }
    />
  ) : (
    <Text
      style={[
        theme.typography.button,
        isCompact && styles.compactLabel,
        Platform.OS === 'android' && styles.androidLabel,
        {
          color: isPrimary
            ? theme.colors.textOnBrand
            : isGhost
              ? theme.colors.brand.solid
              : isDanger
                ? theme.colors.danger
                : theme.colors.textPrimary,
        },
        textStyle,
      ]}
    >
      {label}
    </Text>
  );

  const pressableStyle = ({ pressed }: { pressed: boolean }): ViewStyle[] => [
    styles.base,
    isDanger && {
      backgroundColor: theme.colors.surface,
      borderWidth: 1.5,
      borderColor: theme.colors.danger,
    },
    !isPrimary &&
      !isGhost &&
      !isDanger && {
        backgroundColor: theme.colors.surfaceElevated,
        ...theme.shadows.card,
      },
    isPrimary ? theme.shadows.button : null,
    {
      opacity: opacity * (pressed ? 0.92 : 1),
      borderRadius: theme.radii.pill,
      height,
      minHeight: height,
    },
    style,
  ].filter(Boolean) as ViewStyle[];

  if (isPrimary) {
    return (
      <Pressable onPress={onPress} disabled={disabled || loading} style={pressableStyle}>
        <LinearGradient
          colors={[...theme.gradient.colors]}
          locations={[...theme.gradient.locations]}
          start={theme.gradient.start}
          end={theme.gradient.end}
          style={[styles.gradient, { borderRadius: theme.radii.pill }]}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={pressableStyle}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  gradient: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  compactLabel: {
    fontSize: 15,
    lineHeight: 20,
  },
  androidLabel: {
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
