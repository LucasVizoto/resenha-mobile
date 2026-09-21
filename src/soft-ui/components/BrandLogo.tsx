import React from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { AppTheme } from '../theme';

const logoFull = require('../../../assets/resenha_full.jpg');
const logoMark = require('../../../assets/logo_resenha_mark.png');

type Props = {
  theme: AppTheme;
  /** `mark` = jogador em placa circular (header). `full` = arte com o nome. */
  variant?: 'mark' | 'full';
  size?: number;
  maxHeight?: number;
};

/**
 * Marca Resenha. O recorte circular no header usa a arte sem o nome;
 * a variante full usa a arte com RESENHA e cantos arredondados.
 */
export function BrandLogo({ theme, variant = 'mark', size = 108, maxHeight }: Props) {
  const { height: screenH, width: screenW } = useWindowDimensions();

  if (variant === 'mark') {
    return (
      <View
        style={[
          styles.mark,
          theme.shadows.soft,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      >
        <Image
          source={logoMark}
          style={{ width: size * 0.92, height: size * 0.92 }}
          resizeMode="contain"
          accessibilityLabel="Resenha"
        />
      </View>
    );
  }

  const plateMax = maxHeight ?? Math.min(320, Math.max(200, screenH * 0.36));
  const innerH = plateMax;
  const innerW = Math.min(screenW - 80, innerH * (768 / 1369));

  return (
    <View
      style={[
        styles.plate,
        theme.shadows.card,
        {
          width: innerW,
          height: innerH,
          borderRadius: theme.radii.xl,
        },
      ]}
    >
      <Image
        source={logoFull}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        accessibilityLabel="Resenha"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  plate: {
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
});
