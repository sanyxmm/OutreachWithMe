import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { HEADERS, WIDTHS, type OutputRow } from "./outreach";

export async function exportXlsx(rows: OutputRow[], filename: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Contacts");

  const headerRow = ws.addRow(HEADERS as unknown as string[]);
  headerRow.eachCell((cell) => {
    cell.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
    cell.alignment = { vertical: "middle" };
  });

  for (const row of rows) {
    const r = ws.addRow(row);
    r.eachCell((cell) => {
      cell.font = { name: "Arial", size: 10 };
    });
  }

  WIDTHS.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: rows.length + 1, column: HEADERS.length },
  };

  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/octet-stream" }), filename);
}
