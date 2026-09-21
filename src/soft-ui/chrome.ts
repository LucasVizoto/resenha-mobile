import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const GLASS_TAB_HEIGHT = 62;
export const GLASS_H_INSET = 20;

function useKeyboardInset() {
  const [visible, setVisible] = useState(false);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (event) => {
      setVisible(true);
      setHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      setVisible(false);
      setHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return { visible, height };
}

export function useGlassChrome() {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();
  const systemBottom = Math.max(insets.bottom, Platform.OS === 'android' ? 28 : 8);

  // Teclado aberto: pílula colada nele (sem o recuo do gesture).
  // No iOS a janela não encolhe, então o bottom é a altura do teclado.
  // No Android com resize, o bottom da janela já é o topo do teclado.
  const restBottom = systemBottom + 8;
  const tabBottom = keyboard.visible ? (Platform.OS === 'ios' ? keyboard.height : 6) : restBottom;
  const tabHInset = keyboard.visible ? 10 : GLASS_H_INSET;
  const tabClearance = restBottom + GLASS_TAB_HEIGHT + 12;

  return {
    systemBottom,
    tabBottom,
    tabClearance,
    tabHeight: GLASS_TAB_HEIGHT,
    tabHInset,
    keyboardVisible: keyboard.visible,
  };
}
