import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SoftButton } from './SoftButton';
import { getTheme, type AppTheme } from '../theme';

export type SoftDialogAction = {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  onPress?: () => void | Promise<void>;
};

export type SoftDialogConfig = {
  title: string;
  message?: string;
  actions?: SoftDialogAction[];
};

type DialogApi = {
  show: (config: SoftDialogConfig) => void;
  hide: () => void;
};

const DialogContext = createContext<DialogApi | undefined>(undefined);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const theme = getTheme(useColorScheme() === 'dark' ? 'dark' : 'light');
  const [config, setConfig] = useState<SoftDialogConfig | null>(null);

  const hide = useCallback(() => setConfig(null), []);
  const show = useCallback((next: SoftDialogConfig) => setConfig(next), []);
  const value = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      <SoftDialogModal theme={theme} config={config} onClose={hide} />
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog deve ser usado dentro de DialogProvider');
  return ctx;
}

function SoftDialogModal({
  theme,
  config,
  onClose,
}: {
  theme: AppTheme;
  config: SoftDialogConfig | null;
  onClose: () => void;
}) {
  const actions = config?.actions?.length
    ? config.actions
    : [{ label: 'OK', variant: 'primary' as const }];

  return (
    <Modal visible={Boolean(config)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radii.xl,
              ...theme.shadows.softStrong,
            },
          ]}
        >
          <Text style={[theme.typography.heading, { color: theme.colors.textPrimary, textAlign: 'center' }]}>
            {config?.title}
          </Text>
          {config?.message ? (
            <Text
              style={[
                theme.typography.body,
                {
                  color: theme.colors.textSecondary,
                  textAlign: 'center',
                  marginTop: theme.spacing.sm,
                },
              ]}
            >
              {config.message}
            </Text>
          ) : null}
          <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
            {actions.map((action) => (
              <SoftButton
                key={action.label}
                theme={theme}
                label={action.label}
                variant={action.variant ?? 'primary'}
                onPress={async () => {
                  onClose();
                  const run = action.onPress;
                  if (!run) return;
                  setTimeout(() => {
                    void run();
                  }, 280);
                }}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
});
