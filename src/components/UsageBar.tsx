type UsageBarProps = {
  label: string;
  used: number;
  limit: number | null;
};

export default function UsageBar({ label, used, limit }: UsageBarProps) {
  const percent = limit ? Math.min((used / limit) * 100, 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm text-zinc-400">
        <span>{label}</span>
        <span>{limit ? `${used} / ${limit}` : "Unlimited"}</span>
      </div>
      {limit ? (
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
