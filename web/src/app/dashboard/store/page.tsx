import StoreViewPage from '@/features/store/components/store-view-page';
import { getRewardsSnapshotServer } from '@/features/booking/api/server-service';

export const metadata = {
  title: '席定商店'
};

export default async function StorePage() {
  const snapshot = await getRewardsSnapshotServer();
  return <StoreViewPage initialData={snapshot} />;
}
