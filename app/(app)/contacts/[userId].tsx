import { useLocalSearchParams } from 'expo-router';
import { ContactProfileScreen } from '../../../src/soft-ui/screens/ContactProfileScreen';

export default function ContactProfileRoute() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  return <ContactProfileScreen userId={String(userId ?? '')} />;
}
