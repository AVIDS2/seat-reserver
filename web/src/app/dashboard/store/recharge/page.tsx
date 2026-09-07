import { getRewardsSnapshotServer } from '@/features/booking/api/server-service';
import RechargeViewPage from '@/features/store/components/recharge-view-page';

export const metadata = {
  title: '充值席定币'
};

export default async function RechargePage() {
  const snapshot = await getRewardsSnapshotServer();
  return <RechargeViewPage initialBalance={snapshot.pointsBalance} />;
}
