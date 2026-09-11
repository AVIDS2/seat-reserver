import { getLeaderboardSnapshotServer } from '@/features/booking/api/leaderboard-server-service';
import LeaderboardViewPage from '@/features/booking/components/leaderboard-view-page';

export const metadata = {
  title: '学习排行',
};

export default async function Page() {
  const snapshot = await getLeaderboardSnapshotServer('week');
  return <LeaderboardViewPage initialData={snapshot} />;
}
