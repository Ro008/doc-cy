/**
 * Text for an iCalendar property value (RFC 5545 TEXT): backslash, comma and semicolon escaped,
 * and every line break (CRLF, CR or LF) written as `\n`, so a patient's words can never start a
 * new line, i.e. add properties to the event.
 */
export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
