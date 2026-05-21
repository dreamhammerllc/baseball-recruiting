import type { Metadata } from 'next';
import WaitlistClient from './WaitlistClient';

export const metadata: Metadata = {
  title: 'For College Coaches | Diamond Verified',
  description:
    'The Diamond Verified college coach portal is launching soon. Search verified high school athletes by position, stats, and GPA. Join the waitlist for early access.',
  openGraph: {
    title: 'For College Coaches | Diamond Verified',
    description:
      'Search verified high school athletes by position, stats, and GPA. Join the waitlist for early access to the Diamond Verified college coach portal.',
    type: 'website',
  },
};

export default function ForCollegeCoachesPage() {
  return <WaitlistClient />;
}
