import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Dashboard : Product View'
};

type PageProps = { params: Promise<{ productId: string }> };

export default async function Page(_props: PageProps) {
  redirect('/dashboard/tasks');
}
