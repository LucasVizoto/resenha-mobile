import React from 'react';
import { Image, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { themeFromScheme } from '../theme';

const logoFull = require('../../../assets/resenha_full.jpg');

type Props = {
  onReady?: () => void;
};

/**
 * Splash JS: gradiente Soft UI + arte completa com cantos arredondados.
 * Cobre o carregamento inicial (DB) e o gap do Expo Go, que não replica a splash nativa.
 */
export function AppSplash({ onReady }: Props) {
  const theme = themeFromScheme(useColorScheme());
  const { height: screenH, width: screenW } = useWindowDimensions();
  const cardH = Math.min(420, Math.max(280, screenH * 0.52));
  const cardW = Math.min(screenW * 0.72, cardH * (768 / 1369));

  return (
    <LinearGradient
      colors={[...theme.gradientVertical.colors]}
      locations={[...theme.gradientVertical.locations]}
      start={theme.gradientVertical.start}
      end={theme.gradientVertical.end}
      style={styles.fill}
      onLayout={() => onReady?.()}
    >
      <StatusBar style="light" />
      <View
        style={[
          styles.card,
          theme.shadows.softStrong,
          {
            width: cardW + 8,
            borderRadius: theme.radii.xl,
          },
        ]}
      >
        <Image
          source={logoFull}
          style={{ width: cardW, height: cardH }}
          resizeMode="contain"
          accessibilityLabel="Resenha"
        />
      </View>
      <Text style={[theme.typography.label, styles.subtitle]}>o papo da galera</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  subtitle: {
    marginTop: 22,
    color: '#FFFFFF',
    letterSpacing: 1.4,
    textTransform: 'lowercase',
  },
});
