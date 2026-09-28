import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const GLASS_TAB_HEIGHT = 56;
export const GLASS_H_INSET = 0;

export function useGlassChrome() {
  const insets = useSafeAreaInsets();
  const systemBottom = Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 0);
  const tabHeight = GLASS_TAB_HEIGHT + systemBottom;
  const tabClearance = 20;

  return {
    systemBottom,
    tabBottom: 0,
    tabClearance,
    tabHeight,
    tabHInset: GLASS_H_INSET,
    keyboardVisible: false,
  };
}
