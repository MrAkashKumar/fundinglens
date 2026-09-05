import type { PortfolioResult } from './contracts';
import { sum } from '../analytics';
export function summarizePortfolios(portfolios: PortfolioResult[]) {
  const complete =
    portfolios.length > 0 && portfolios.every((p) => p.total !== null);
  const positions = portfolios.flatMap((p) => p.positions);
  const total = complete ? sum(portfolios.map((p) => p.total!)) : null;
  function group(key: 'assetClass' | 'liquidity') {
    const totals = new Map<string, number[]>();
    for (const p of positions)
      totals.set(p[key], [...(totals.get(p[key]) || []), p.value]);
    return [...totals]
      .map(([name, values]) => ({
        name,
        value: sum(values),
        percent: total && total > 0 ? (sum(values) / total) * 100 : null,
      }))
      .sort((a, b) => b.value - a.value);
  }
  return {
    complete,
    total,
    holdings: positions.length,
    assets: complete ? group('assetClass') : [],
    access: complete ? group('liquidity') : [],
    restricted: complete
      ? sum(
          positions
            .filter((p) =>
              ['Monthly', 'Quarterly Gate', 'Illiquid'].includes(p.liquidity),
            )
            .map((p) => p.value),
        )
      : null,
  };
}
