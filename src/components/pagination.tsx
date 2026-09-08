export function Pagination({
  page,
  pages,
  total,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (!total) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-[#5d6f6b]">{total} total</p>
      {pages > 1 ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full border border-[#ddd4c4] bg-white px-4 text-sm disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            Prev
          </button>
          <span className="min-w-16 text-center text-sm">
            {page} / {pages}
          </span>
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full border border-[#ddd4c4] bg-white px-4 text-sm disabled:opacity-40"
            disabled={page >= pages}
            onClick={() => onPage(page + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
