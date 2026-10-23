import { packages, stages } from '@/content/pricing';
import type { BlockOf } from './schema';

type TableData = Pick<BlockOf<'table'>, 'columns' | 'rows' | 'services'>;

// The pricing tables as they were in the PDF. New pricing slides and older deck files start from these.
export function stagesTable(): TableData {
  return {
    columns: [
      { id: 'stage', label: 'RIBA stage', width: 22, role: 'key' },
      { id: 'scope', label: 'Scope of services', width: 33, role: 'text' },
      { id: 'pricing', label: 'Pricing approach', width: 45, role: 'text' },
    ],
    rows: stages.map((s) => ({ id: s.id, cells: [s.stage, s.scope, s.pricing] })),
    services: false,
  };
}

export function packagesTable(): TableData {
  return {
    columns: [
      { id: 'number', label: 'No.', width: 6, role: 'text' },
      { id: 'package', label: 'Package', width: 35, role: 'name' },
      { id: 'scope', label: 'Scope', width: 45, role: 'text' },
      { id: 'fee', label: 'Fee', width: 14, role: 'fee' },
    ],
    rows: packages.map((p) => ({ id: p.id, cells: [String(p.number), p.name, p.scope, p.fee] })),
    services: true,
  };
}

// What a table row is called in the enquiry form: its name column, else its first non-empty cell
export function rowLabel(table: Pick<BlockOf<'table'>, 'columns'>, cells: string[]) {
  const named = table.columns.findIndex((c) => c.role === 'name' || c.role === 'key');
  return (named >= 0 ? cells[named] : undefined)?.trim() || cells.find((c) => c.trim())?.trim() || '';
}
