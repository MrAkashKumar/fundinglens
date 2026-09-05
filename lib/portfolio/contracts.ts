import type { Row } from '../types';
export type Evidence = { id: string; file: string; label: string; fields: Row };
export type Position = {
  id: string;
  portfolioId: string;
  name: string;
  assetClass: string;
  currency: string;
  value: number;
  weight: number | null;
  liquidity: string;
  valuationDate: string;
  evidence: Evidence;
};
export type Finding = {
  id: string;
  ruleId: string;
  portfolioId: string;
  category:
    | 'Allocation'
    | 'Concentration'
    | 'Funding access'
    | 'Capital calls'
    | 'Valuation'
    | 'Data quality';
  title: string;
  detail: string;
  reason: string;
  nextStep: string;
  audience: 'client_review' | 'internal';
  evidence: Evidence[];
};
export type PortfolioResult = {
  id: string;
  name: string;
  service: string;
  mandateBands: Row[];
  mandate: string;
  total: number | null;
  positions: Position[];
  findings: Finding[];
};
export type ClientReview = {
  id: string;
  name: string;
  rm: string;
  objective: string;
  risk: string;
  currency: string;
  language: string;
  asOf: string;
  portfolios: PortfolioResult[];
  plannedNeeds: Row[];
  collateralPortfolioIds: string[];
  commitments: Row[];
  total: number | null;
  findings: Finding[];
};
export type PortfolioBook = {
  asOf: string;
  clients: ClientReview[];
  coverage: { clients: number; portfolios: number; currentHoldings: number };
  ruleDescriptions: { id: string; description: string }[];
};
export interface PortfolioRepository {
  clients(): Row[];
  portfolios(clientId: string): Row[];
  holdings(portfolioId: string, asOf: string): Row[];
  instrument(id: string): Row | undefined;
  mandates(code: string): Row[];
  needs(clientId: string): Row[];
  commitments(clientId: string): Row[];
  creditFacilities(clientId: string): Row[];
}
export type RuleContext = {
  portfolio: Row;
  client: Row;
  asOf: string;
  total: number;
  positions: Position[];
  instruments: Map<string, Row>;
  mandates: Row[];
  needs: Row[];
  commitments: Row[];
};
export type Candidate = Omit<Finding, 'id' | 'portfolioId' | 'ruleId'>;
export interface ReviewRule {
  id: string;
  description: string;
  evaluate(context: RuleContext): Candidate[];
}
