import { Linking } from 'react-native';

export async function openGoogleMaps(latitude: number, longitude: number): Promise<void> {
  const lat = latitude.toFixed(6);
  const lng = longitude.toFixed(6);
  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    throw new Error('Não foi possível abrir o Google Maps neste aparelho.');
  }
  await Linking.openURL(url);
}
