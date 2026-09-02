import { LandingPage } from '@/features/landing/opensaas/LandingPage';
import { getPlatformUserServer } from '@/features/booking/api/server-service';

export default async function Page() {
  const user = await getPlatformUserServer();
  return <LandingPage user={user} />;
}
