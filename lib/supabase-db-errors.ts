export function isSupabaseMissingTableError(error: {
  code?: string;
  message?: string;
}): boolean {
  const code = String(error.code ?? "");
  const msg = String(error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /relation.*does not exist/.test(msg) ||
    /could not find the table/.test(msg)
  );
}
