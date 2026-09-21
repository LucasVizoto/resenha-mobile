import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AppTheme } from '../theme';

type Props = {
  theme: AppTheme;
  title: string;
  description?: string;
};

export function SoftEmptyState({ theme, title, description }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={[theme.typography.heading, { color: theme.colors.textPrimary, textAlign: 'center' }]}>
        {title}
      </Text>
      {description ? (
        <Text
          style={[
            theme.typography.body,
            { color: theme.colors.textSecondary, textAlign: 'center', marginTop: theme.spacing.sm },
          ]}
        >
          {description}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 28,
    paddingVertical: 40,
    alignItems: 'center',
  },
});
