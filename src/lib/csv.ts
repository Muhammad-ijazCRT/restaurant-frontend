type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

function escapeCsvCell(raw: string | number | null | undefined): string {
  const str = raw == null ? "" : String(raw);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCsv<T>(
  filename: string,
  columns: CsvColumn<T>[],
  rows: T[],
): void {
  const header = columns.map(c => escapeCsvCell(c.header)).join(",");
  const body = rows
    .map(row => columns.map(c => escapeCsvCell(c.value(row))).join(","))
    .join("\n");

  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function csvFilename(base: string, tag?: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const parts = tag ? `${base}-${tag}` : base;
  return `${parts}-${date}.csv`;
}
