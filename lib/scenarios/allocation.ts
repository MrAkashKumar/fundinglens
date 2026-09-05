import { number } from '../analytics';
import type { PortfolioResult } from '../portfolio/contracts';
import type { SaleScenario } from './model';
export function afterSaleAllocation(
  portfolios: PortfolioResult[],
  scenario: SaleScenario,
) {
  return portfolios.flatMap((p) => {
    const denominator =
      (p.total || 0) -
      scenario.sales
        .filter((s) => s.portfolioId === p.id)
        .reduce((n, s) => n + s.gross, 0);
    const classes = new Set([
      ...p.positions.map((h) => h.assetClass),
      ...p.mandateBands.map((b) => b.asset_class),
    ]);
    return [...classes].map((assetClass) => {
      const before = p.positions
        .filter((h) => h.assetClass === assetClass)
        .reduce((n, h) => n + h.value, 0);
      const sold = scenario.sales
        .filter((s) => s.portfolioId === p.id && s.assetClass === assetClass)
        .reduce((n, s) => n + s.gross, 0);
      const bands = p.mandateBands.filter((b) => b.asset_class === assetClass);
      const min = bands.length === 1 ? number(bands[0].min_pct) : null;
      const max = bands.length === 1 ? number(bands[0].max_pct) : null;
      const afterPct =
        denominator > 0 ? ((before - sold) / denominator) * 100 : null;
      const assess =
        p.service !== 'Custody' &&
        min !== null &&
        max !== null &&
        min >= 0 &&
        max <= 100 &&
        min <= max &&
        afterPct !== null;
      return {
        portfolioId: p.id,
        assetClass,
        beforePct: p.total && p.total > 0 ? (before / p.total) * 100 : null,
        afterPct,
        min,
        max,
        status: !assess
          ? 'Not assessed'
          : afterPct < min - 1e-8 || afterPct > max + 1e-8
            ? 'Outside supplied range'
            : 'Within supplied range',
      };
    });
  });
}
