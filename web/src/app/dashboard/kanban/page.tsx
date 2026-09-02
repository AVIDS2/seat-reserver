import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Dashboard : Kanban view'
};

export default function Page() {
  redirect('/dashboard/tasks');
}
