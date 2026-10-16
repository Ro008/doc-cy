// Whether `supabase db push` would apply migrations to a project, read from supabase/config.toml.
//
// The file turns migrations off for the local CI stack ([db.migrations] enabled = false) and
// turns them back on for the real projects with a [remotes.<name>] block matched by project
// ref. Without that block the push says "Skipping migrations ... disabled in config.toml",
// applies nothing and exits 0 (2026-10-16). Only the few TOML lines this needs are read.

function stripComment(line) {
  const at = line.indexOf("#");
  return (at === -1 ? line : line.slice(0, at)).trim();
}

/** Tables of the file as `{ header, values }`, in order, without comments. */
function tables(toml) {
  const found = [{ header: "", values: {} }];
  for (const raw of String(toml).split(/\r?\n/)) {
    const line = stripComment(raw);
    if (!line) continue;
    const header = /^\[([^\]]+)\]$/.exec(line);
    if (header) {
      found.push({ header: header[1].trim(), values: {} });
      continue;
    }
    const pair = /^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/.exec(line);
    if (pair) found[found.length - 1].values[pair[1]] = pair[2].trim().replace(/^"(.*)"$/, "$1");
  }
  return found;
}

export function migrationsEnabledForProject(toml, projectRef) {
  const all = tables(toml);
  const remote = all.find((t) => /^remotes\.[^.]+$/.test(t.header) && t.values.project_id === projectRef);
  if (remote) {
    const own = all.find((t) => t.header === `${remote.header}.db.migrations`);
    return own?.values.enabled === "true";
  }
  return all.find((t) => t.header === "db.migrations")?.values.enabled === "true";
}
