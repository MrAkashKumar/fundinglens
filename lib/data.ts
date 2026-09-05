import { parse } from 'csv-parse/sync';
import clients from '../data/clients.csv?raw';
import portfolios from '../data/portfolios.csv?raw';
import holdings from '../data/holdings.csv?raw';
import instruments from '../data/instruments.csv?raw';
import mandates from '../data/mandates.csv?raw';
import needs from '../data/planned_cash_needs.csv?raw';
import commitments from '../data/commitments.csv?raw';
import transactions from '../data/transactions.csv?raw';
import events from '../data/event_log.csv?raw';
import market from '../data/market_context.csv?raw';
import notes from '../data/rm_notes.json';
import creditFacilities from '../data/credit_facilities.csv?raw';
import type { Row } from './types';
export const AS_OF = '2026-08-26';
export const DATES = [
  '2025-12-31',
  '2026-02-27',
  '2026-03-31',
  '2026-06-30',
  AS_OF,
];
export const readCsv = (text: string): Row[] =>
  parse(text, { columns: true, skip_empty_lines: true, bom: true, trim: true });
export const data = {
  clients: readCsv(clients),
  creditFacilities: readCsv(creditFacilities),
  portfolios: readCsv(portfolios),
  holdings: readCsv(holdings),
  instruments: readCsv(instruments),
  mandates: readCsv(mandates),
  needs: readCsv(needs),
  commitments: readCsv(commitments),
  transactions: readCsv(transactions),
  events: readCsv(events),
  market: readCsv(market),
  notes: notes as Row[],
};
export type DataSet = typeof data;
