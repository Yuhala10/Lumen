export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6" aria-busy="true">
      <div className="shimmer h-10 w-64 rounded-xl bg-sunken" />
      <div className="shimmer mt-3 h-4 w-96 max-w-full rounded-lg bg-sunken" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="shimmer h-44 rounded-2xl border border-line bg-surface" />
        ))}
      </div>
    </div>
  );
}
