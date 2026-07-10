import { PermissionDetailScreen } from '@/features/security/screens/PermissionDetailScreen';
import { useLocalSearchParams } from 'expo-router';

export default function ProfileDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  
  return <PermissionDetailScreen profileId={id} />;
}
