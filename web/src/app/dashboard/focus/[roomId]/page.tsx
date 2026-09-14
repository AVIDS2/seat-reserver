import { notFound } from 'next/navigation';

import { getFocusRoomServer } from '@/features/focus/api/server-service';
import FocusRoomPage from '@/features/focus/components/focus-room-page';

export const metadata = {
  title: '专注房',
};

export default async function Page({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  try {
    const room = await getFocusRoomServer(roomId);
    return <FocusRoomPage initialRoom={room} />;
  } catch {
    notFound();
  }
}
