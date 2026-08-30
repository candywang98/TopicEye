type Variant = 'list' | 'detail' | 'dashboard';

const widths = ['w-5/6', 'w-2/3', 'w-4/5'];

export function PageSkeleton({ variant = 'list' }: { variant?: Variant }) {
  const cardCount = variant === 'dashboard' ? 6 : variant === 'detail' ? 3 : 5;
  return (
    <div role="status" aria-live="polite" aria-label="页面加载中" className="min-h-full animate-pulse bg-page px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1220px]">
        <div className="h-6 w-40 rounded bg-gray-200" />
        <div className="mt-3 h-3 w-72 max-w-full rounded bg-gray-100" />
        {variant === 'dashboard' && (
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 rounded-lg bg-white shadow-sm" />)}
          </div>
        )}
        <div className={`mt-6 grid gap-3${variant === 'dashboard' ? ' lg:grid-cols-2' : ''}`}>
          {Array.from({ length: cardCount }, (_, index) => (
            <div key={index} className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
              <div className={`h-4 rounded bg-gray-200 ${widths[index % widths.length]}`} />
              <div className="mt-4 h-3 w-full rounded bg-gray-100" />
              <div className="mt-2 h-3 w-3/4 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">正在切换页面…</span>
    </div>
  );
}
