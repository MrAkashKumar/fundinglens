import FundingDesk from '@/components/FundingDesk';
import { data } from '@/lib/data';
import { buildReview } from '@/lib/reviews';
export default function Home() {
  return <FundingDesk initialReview={buildReview(data, 'CL-0006')} />;
}
