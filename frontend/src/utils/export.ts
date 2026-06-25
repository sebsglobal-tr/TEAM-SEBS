/**
 * CSV dosyası olarak dışa aktarır.
 * @param data Dizi şeklinde veri
 * @param filename İndirilen dosyanın adı
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columnLabels?: Partial<Record<keyof T, string>>,
) {
  if (data.length === 0) return;

  const keys = Object.keys(data[0]) as (keyof T)[];
  const labels = keys.map((k) => {
    // Türkçe karakterleri temizle, label varsa kullan yoksa key'i başlık yap
    const label = columnLabels?.[k] ?? String(k);
    return `"${label}"`;
  });

  const rows = data.map((item) =>
    keys
      .map((k) => {
        const val = item[k];
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""'); // escape quotes
        return `"${str}"`;
      })
      .join(','),
  );

  const csv = '﻿' + [labels.join(','), ...rows].join('\n'); // BOM for Turkish chars
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename.replace(/[^a-zA-Z0-9çÇğĞıİöÖşŞüÜ_-]/g, '_')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
