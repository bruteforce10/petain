import type { ScrapeRunSummary, ScrapeSource } from '@terramap/types';

const SOURCE_LABELS: Record<ScrapeSource, string> = {
  gmaps: 'Google Maps',
  shopee: 'Shopee',
  tokopedia: 'Tokopedia',
};

const STATUS_STYLES: Record<ScrapeRunSummary['status'], string> = {
  running: 'bg-amber-100 text-amber-700',
  success: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

function fmtDateTime(v: string) {
  return new Date(v).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export interface ScrapeRunListProps {
  runs: ScrapeRunSummary[];
  onOpen: (run: ScrapeRunSummary) => void;
}

export function ScrapeRunList({ runs, onOpen }: ScrapeRunListProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-600">
          <tr>
            <th className="px-3 py-2 font-medium">Title</th>
            <th className="px-3 py-2 font-medium">Source</th>
            <th className="px-3 py-2 font-medium">Created</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium text-right">Rows</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {runs.map((r) => (
            <tr
              key={r.id}
              className="cursor-pointer hover:bg-gray-50"
              onClick={() => onOpen(r)}
            >
              <td className="px-3 py-2">
                <span className="line-clamp-2 max-w-md font-medium text-brand">{r.title}</span>
              </td>
              <td className="px-3 py-2 text-gray-600">{SOURCE_LABELS[r.source]}</td>
              <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                {fmtDateTime(r.created_at)}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}
                >
                  {r.status}
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{r.row_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
