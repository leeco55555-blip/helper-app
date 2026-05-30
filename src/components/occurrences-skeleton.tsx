export function OccurrencesSkeleton() {
  return (
    <div className="max-w-2xl mx-auto w-full px-4 pt-2 flex flex-col gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="card h-20 animate-pulse"
          style={{ opacity: 0.5 }}
          aria-hidden
        />
      ))}
    </div>
  );
}
