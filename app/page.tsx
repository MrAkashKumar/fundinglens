import PortfolioDesk from '@/components/portfolio/PortfolioDesk';
import { data, AS_OF } from '@/lib/data';
import { DatasetPortfolioRepository } from '@/lib/portfolio/repository';
import { PortfolioReviewService } from '@/lib/portfolio/service';
export default function Home() {
  const service = new PortfolioReviewService(
    new DatasetPortfolioRepository(data),
  );
  return <PortfolioDesk book={service.reviewBook(AS_OF)} />;
}
