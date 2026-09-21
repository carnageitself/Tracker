import { CARD } from "./ui";

export type StatTileProps = {
  label: string;
  value: string;
  detail?: string;
  /** Renders larger as the one figure the dashboard leads with. */
  hero?: boolean;
};

export function StatTile({ label, value, detail, hero = false }: StatTileProps) {
  return (
    <div className={`${CARD} p-4 sm:p-5`}>
      <p className="text-xs font-medium text-ink-secondary">{label}</p>
      {/* Proportional figures: tabular-nums makes large standalone numbers
          look loose. Alignment only matters in the table's columns. */}
      <p
        className={`mt-1.5 font-semibold tracking-tight text-ink ${
          hero ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl"
        }`}
      >
        {value}
      </p>
      {detail ? (
        <p className="mt-1 truncate text-xs text-ink-muted" title={detail}>
          {detail}
        </p>
      ) : null}
    </div>
  );
}
