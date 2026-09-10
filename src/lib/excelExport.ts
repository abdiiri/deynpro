import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export interface ExportSheet {
  name: string;
  rows: Record<string, any>[];
}

export function exportToExcel(filename: string, sheets: ExportSheet[]) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: 'No data' }]);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });
  const stamp = format(new Date(), 'yyyy-MM-dd_HHmm');
  XLSX.writeFile(wb, `${filename}_${stamp}.xlsx`);
}
