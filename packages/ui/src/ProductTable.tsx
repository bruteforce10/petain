import type { ProductRow } from '@petain/types';

const RUPIAH = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

function fmtPrice(v: number | null | undefined) {
  return v == null ? '—' : RUPIAH.format(v);
}

function fmtNum(v: number | null | undefined) {
  return v == null ? '—' : new Intl.NumberFormat('id-ID').format(v);
}

function fmtDate(v: string | null | undefined) {
  if (!v) return '—';
  return new Date(v).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export interface ProductTableProps {
  rows: ProductRow[];
}

export function ProductTable({ rows }: ProductTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Product</th>
            <th className="px-3 py-2 font-medium">Source</th>
            <th className="px-3 py-2 font-medium text-right">Price</th>
            <th className="px-3 py-2 font-medium text-right">Rating</th>
            <th className="px-3 py-2 font-medium text-right">Sold</th>
            <th className="px-3 py-2 font-medium">Seller</th>
            <th className="px-3 py-2 font-medium">Scraped</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((p) => (
            <tr key={p.id} className="hover:bg-muted">
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  {p.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt=""
                      className="h-10 w-10 rounded object-cover"
                      loading="lazy"
                    />
                  )}
                  {p.product_url ? (
                    <a
                      href={p.product_url}
                      target="_blank"
                      rel="noreferrer"
                      className="line-clamp-2 max-w-xs text-primary hover:underline"
                    >
                      {p.name}
                    </a>
                  ) : (
                    <span className="line-clamp-2 max-w-xs">{p.name}</span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2 capitalize text-muted-foreground">{p.source}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtPrice(p.price)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{p.rating ?? '—'}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtNum(p.sold_count)}</td>
              <td className="px-3 py-2 text-muted-foreground">{p.seller ?? '—'}</td>
              <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{fmtDate(p.scraped_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
