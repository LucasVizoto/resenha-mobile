import React from 'react';
import { Image, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { themeFromScheme } from '../theme';

const logoFull = require('../../../assets/resenha_full.jpg');

type Props = {
  onReady?: () => void;
};

/**
 * Splash JS enquanto o SQLite abre. A splash nativa só some no _layout,
 * depois desta tela já ter pintado — esconder cedo no Android fecha o app.
 */
export function AppSplash({ onReady }: Props) {
  const theme = themeFromScheme(useColorScheme());
  const { height: screenH, width: screenW } = useWindowDimensions();
  const cardH = Math.min(420, Math.max(280, screenH * 0.52));
  const cardW = Math.min(screenW * 0.72, cardH * (768 / 1369));

  return (
    <View style={styles.fill} onLayout={() => onReady?.()}>
      <StatusBar style="dark" />
      <View
        style={[
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
      <Text style={[theme.typography.label, styles.subtitle]}></Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
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
