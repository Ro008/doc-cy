/** Shared inline styles for transactional DocCy emails (Clinical Trust palette). */

export const EMAIL_FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export const EMAIL_OUTER_BG = "#0F1F2E";
export const EMAIL_CARD_BG = "#1A2B3C";
export const EMAIL_TEXT = "#EEF4F8";
export const EMAIL_TEXT_MUTED = "#B0BEC9";
export const EMAIL_HEADING = "#F7FAFC";

export const EMAIL_SHELL_OPEN = `<div style="margin:0;padding:20px;background:${EMAIL_OUTER_BG};color:${EMAIL_TEXT};font-family:${EMAIL_FONT};">
  <div style="max-width:560px;margin:0 auto;background:${EMAIL_CARD_BG};border:1px solid rgba(176,190,201,.22);border-radius:16px;padding:22px;">`;

export const EMAIL_SHELL_CLOSE = `</div></div>`;

/** Primary CTA — calendar Google, book again, choose time, etc. */
export const EMAIL_PRIMARY_BTN =
  "display:block;text-align:center;background:#0B7BB5;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 16px;border-radius:12px;margin:0 0 12px;font-size:15px;";

/** Google Calendar button (slightly smaller padding variant). */
export const EMAIL_CAL_GOOGLE_BTN =
  "display:block;text-align:center;background:#0B7BB5;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 14px;border-radius:12px;margin:0 0 10px;font-size:15px;";

/** Apple / Outlook .ics secondary button. */
export const EMAIL_CAL_ICS_BTN =
  "display:block;text-align:center;background:rgba(11,123,181,.16);color:#C5E4F3;text-decoration:none;font-weight:700;padding:12px 14px;border-radius:12px;border:1px solid rgba(11,123,181,.4);font-size:15px;";

export const EMAIL_LINK_ACCENT =
  "color:#9FD0EA;font-weight:600;text-decoration:none;";

export const EMAIL_SECTION_LABEL =
  "margin:18px 0 10px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#8A9BB0;";

/** Inline CTA for practice website embed scripts. */
export const EMAIL_INLINE_CTA_BTN =
  "display:inline-block;padding:12px 20px;background:#0B7BB5;color:#ffffff;font-weight:600;text-decoration:none;border-radius:8px;";
