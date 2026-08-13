/** Root `<html lang>` is `en`. Greek booking URLs (`/el/...`) switch after paint / inline script. */
export function htmlLangFromPathname(pathname: string): "en" | "el" {
  const first = pathname.split("/").filter(Boolean)[0];
  return first === "el" ? "el" : "en";
}
