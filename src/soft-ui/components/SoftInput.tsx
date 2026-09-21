import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  Pressable,
} from 'react-native';
import type { AppTheme } from '../theme';
import { IconEye, IconEyeOff } from './SoftIcons';

type Props = TextInputProps & {
  theme: AppTheme;
  label?: string;
  hint?: string;
  containerStyle?: ViewStyle;
  error?: string;
  leftIcon?: React.ReactNode;
  rightAccessory?: React.ReactNode;
  /** Olho para revelar senha (usa secureTextEntry). */
  passwordToggle?: boolean;
};

/** Input pílula Soft UI — borda cinza clara, ícones laterais. */
export function SoftInput({
  theme,
  label,
  hint,
  containerStyle,
  error,
  style,
  leftIcon,
  rightAccessory,
  passwordToggle,
  secureTextEntry,
  ...rest
}: Props) {
  const [hidden, setHidden] = useState(true);
  const secure = passwordToggle ? hidden : secureTextEntry;

  return (
    <View style={containerStyle}>
      {label ? (
        <Text
          style={[
            theme.typography.label,
            { color: theme.colors.textSecondary, marginBottom: theme.spacing.xs },
          ]}
        >
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          theme.shadows.soft,
          {
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.pill,
            borderWidth: 1,
            borderColor: error ? theme.colors.danger : theme.colors.borderSubtle,
          },
        ]}
      >
        {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
        <TextInput
          placeholderTextColor={theme.colors.placeholder}
          secureTextEntry={secure}
          style={[
            theme.typography.body,
            styles.input,
            { color: theme.colors.textPrimary },
            style,
          ]}
          {...rest}
        />
        {passwordToggle ? (
          <Pressable
            onPress={() => setHidden((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar senha' : 'Ocultar senha'}
          >
            {hidden ? (
              <IconEye color={theme.colors.textMuted} />
            ) : (
              <IconEyeOff color={theme.colors.textMuted} />
            )}
          </Pressable>
        ) : (
          rightAccessory
        )}
      </View>
      {error ? (
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.danger, marginTop: theme.spacing.xxs },
          ]}
        >
          {error}
        </Text>
      ) : null}
      {!error && hint ? (
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textSecondary, marginTop: theme.spacing.xxs },
          ]}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 10,
  },
  icon: {
    width: 22,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: 14,
  },
});
