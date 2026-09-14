import { getFocusRoomsServer } from '@/features/focus/api/server-service';
import FocusRoomLobbyPage from '@/features/focus/components/focus-room-lobby';

export const metadata = {
  title: '番茄自习室',
};

export default async function Page() {
  const snapshot = await getFocusRoomsServer();
  return <FocusRoomLobbyPage initialData={snapshot} />;
}
