import { Suspense } from 'react';
import CoachDashboardClient from './CoachDashboardClient';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default function CoachDashboard() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CoachDashboardClient />
    </Suspense>
  );
}
