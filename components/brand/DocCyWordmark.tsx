type DocCyWordmarkProps = {
  className?: string;
  /** `light` for pale clinical backgrounds; `dark` for slate/neutral dark UI. */
  variant?: "light" | "dark";
};

export function DocCyWordmark({
  className = "",
  variant = "dark",
}: DocCyWordmarkProps) {
  const docColor = variant === "light" ? "text-ink-800" : "text-slate-50";

  return (
    <span
      className={`inline-flex items-baseline text-lg font-semibold leading-none tracking-tight ${docColor} ${className}`.trim()}
      aria-label="DocCy"
    >
      <span>Doc</span>
      <span className="text-clinical-500">Cy</span>
    </span>
  );
}
