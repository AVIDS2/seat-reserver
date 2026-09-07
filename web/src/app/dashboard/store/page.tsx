import StoreViewPage from '@/features/store/components/store-view-page';
import { getRewardsSnapshotServer } from '@/features/booking/api/server-service';

export const metadata = {
  title: '席定商店'
};

export default async function StorePage({
  searchParams
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const snapshot = await getRewardsSnapshotServer();
  const params = await searchParams;
  const checkout =
    params.checkout === 'success' || params.checkout === 'cancelled' ? params.checkout : null;
  return <StoreViewPage initialData={snapshot} checkoutResult={checkout} />;
}
