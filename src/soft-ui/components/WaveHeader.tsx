import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import type { AppTheme } from '../theme';

type Props = {
  theme: AppTheme;
  title?: string;
  subtitle?: string;
  /** Altura do bloco azul + onda (sem contar o safe area). */
  height?: number;
  children?: React.ReactNode;
};

/**
 * Header Soft UI: gradiente azul + corte em onda.
 * Variante alta (login) recebe logo via children; a compacta só o título.
 */
export function WaveHeader({ theme, title, subtitle, height = 148, children }: Props) {
  const { width: screenW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const waveH = 56;
  const bodyH = Math.max(88, height - waveH) + insets.top;

  return (
    <View style={{ width: '100%' }}>
      <LinearGradient
        colors={[...theme.gradientVertical.colors]}
        locations={[...theme.gradientVertical.locations]}
        start={theme.gradientVertical.start}
        end={theme.gradientVertical.end}
        style={[styles.gradientBody, { height: bodyH, paddingTop: insets.top + 8 }]}
      >
        {children}
        {title ? (
          <Text style={[theme.typography.title, styles.title]}>{title}</Text>
        ) : null}
        {subtitle ? (
          <View style={styles.tagline}>
            <View style={styles.tagLine} />
            <Text style={[theme.typography.label, styles.subtitle]}>{subtitle}</Text>
            <View style={styles.tagLine} />
          </View>
        ) : null}
      </LinearGradient>
      <Svg
        width={screenW}
        height={waveH}
        viewBox={`0 0 ${screenW} ${waveH}`}
        style={styles.wave}
      >
        <Path
          d={`M0 0 L${screenW} 0 L${screenW} ${waveH * 0.22} Q${screenW / 2} ${waveH * 1.08} 0 ${waveH * 0.22} Z`}
          fill={theme.gradientVertical.colors[1]}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  gradientBody: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 4,
    gap: 8,
  },
  wave: {
    marginTop: -1,
  },
  title: {
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 4,
  },
  tagline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  tagLine: {
    width: 28,
    height: StyleSheet.hairlineWidth + 1,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 1,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
  },
});
