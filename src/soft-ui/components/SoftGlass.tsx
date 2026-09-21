import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import type { AppTheme } from '../theme';

type Props = {
  theme: AppTheme;
  children?: React.ReactNode;
  intensity?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

function frostFill(theme: AppTheme) {
  return theme.mode === 'dark' ? 'rgba(20, 20, 28, 0.94)' : 'rgba(247, 248, 251, 0.94)';
}

function frostBorder(theme: AppTheme) {
  return theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.7)';
}

/**
 * Pílula fosca: blur nativo no iOS + camada densa para não ler o que está atrás.
 * No Android o blur exige blurTarget, então o fosco opaco faz o mesmo papel.
 */
export function SoftGlass({
  theme,
  children,
  intensity = 80,
  radius = 28,
  style,
  contentStyle,
}: Props) {
  return (
    <View
      style={[
        {
          borderRadius: radius,
          overflow: 'hidden',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: frostBorder(theme),
        },
        style,
      ]}
    >
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={intensity}
          tint={theme.mode === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: frostFill(theme) }]} />
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

export function SoftGlassBackdrop({ theme, intensity = 90 }: { theme: AppTheme; intensity?: number }) {
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={intensity}
          tint={theme.mode === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: frostFill(theme) }]} />
    </View>
  );
}
