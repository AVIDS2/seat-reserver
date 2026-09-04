import MembershipViewPage from '@/features/membership/components/membership-view-page';
import { getRewardsSnapshotServer } from '@/features/booking/api/server-service';

export const metadata = {
  title: '会员与邀请'
};

export default async function Page() {
  const snapshot = await getRewardsSnapshotServer();
  return <MembershipViewPage initialData={snapshot} />;
}
