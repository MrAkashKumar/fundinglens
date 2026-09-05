import type { DataSet } from '../data';
import type { Row } from '../types';
import type { PortfolioRepository } from './contracts';
// Storage adapter: rules depend on the interface, not CSV parsing or a database.
export class DatasetPortfolioRepository implements PortfolioRepository {
  private readonly instrumentsById: Map<string, Row>;
  constructor(private readonly data: DataSet) {
    this.instrumentsById = new Map(
      data.instruments.map((row) => [row.instrument_id, row]),
    );
  }
  creditFacilities(id: string) {
    return (this.data.creditFacilities || []).filter(
      (row) => row.client_id === id,
    );
  }
  clients() {
    return this.data.clients;
  }
  portfolios(id: string) {
    return this.data.portfolios.filter((row) => row.client_id === id);
  }
  holdings(id: string, date: string) {
    return this.data.holdings.filter(
      (row) => row.portfolio_id === id && row.snapshot_date === date,
    );
  }
  instrument(id: string) {
    return this.instrumentsById.get(id);
  }
  mandates(code: string) {
    return this.data.mandates.filter((row) => row.mandate_code === code);
  }
  commitments(id: string) {
    return this.data.commitments.filter((row) => row.client_id === id);
  }
  needs(id: string) {
    return this.data.needs.filter((row) => row.client_id === id);
  }
}
