export type Row = Record<string, string>;
export type Source = {
  id: string;
  file: string;
  key: string;
  date: string;
  label: string;
  fields: Row;
  kind: 'record' | 'calculation';
  inputs?: string[];
};
export type Fact = {
  id: string;
  label: string;
  value: number;
  currency?: string;
  unit?: string;
  sources: string[];
};
export type Statement = { text: string; evidenceIds: string[] };
export type DraftContent = {
  opening: Statement;
  whyItMatters: Statement;
  questions: Statement[];
  nextStep: Statement;
  caveat: Statement;
};
export type Briefing = {
  clientId: string;
  inputVersion: string;
  mode: 'live_ai' | 'template_fallback';
  fallbackReason?: string;
  content: DraftContent;
  factIds: string[];
};
export type Review = {
  clientId: string;
  inputVersion: string;
  asOf: string;
  comparisonStart: string;
  comparisonEnd: string;
  client: {
    name: string;
    short: string;
    risk: string;
    language: string;
    goal: string;
    bookingCentre: string;
    portfolioId: string;
    inception: string;
  };
  type: 'funding' | 'inheritance' | 'retirement';
  title: string;
  question: string;
  action: string;
  status: string;
  unknowns: string[];
  total: number;
  liquidity: {
    tier: string;
    value: number;
    holdings: {
      name: string;
      value: number;
      currency: string;
      assetClass: string;
      sourceId: string;
    }[];
  }[];
  allocation: {
    assetClass: string;
    value: number;
    weight: number;
    min: number | null;
    max: number | null;
    exception: boolean | null;
    sourceIds: string[];
  }[];
  history: { date: string; value: number | null; preInception: boolean }[];
  change: { absolute: number | null; percent: number | null };
  obligations: {
    id: string;
    description: string;
    amount: number | null;
    currency: string;
    from: string;
    to: string;
    recurrence: string;
    certainty: string;
    sourceIds: string[];
    note: string;
  }[];
  facts: Fact[];
  evidence: Source[];
  warnings: string[];
  template: DraftContent;
  events: {
    date: string;
    description: string;
    channel: string;
    sourceId: string;
  }[];
  singleExceptions: {
    name: string;
    weight: number;
    max: number;
    sourceIds: string[];
  }[];
};
export type Revision = {
  id: string;
  clientId: string;
  inputVersion: string;
  revision: number;
  text: string;
  mode: Briefing['mode'];
  fallbackReason?: string;
  status: 'draft' | 'reviewed' | 'rejected';
  updatedAt: string;
  reviewedAt?: string;
  evidenceIds: string[];
};
