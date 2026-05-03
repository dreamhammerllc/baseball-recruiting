import dynamic from 'next/dynamic';

const CoachDashboardClient = dynamic(() => import('./CoachDashboardClient'), { ssr: false });

export default function CoachDashboard() {
  return <CoachDashboardClient />;
}
