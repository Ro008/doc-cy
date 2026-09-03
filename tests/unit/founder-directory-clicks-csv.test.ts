import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  directoryClickProfileUrl,
  directoryClicksCsvFilename,
  serializeDirectoryClicksCsv,
  shouldOmitDirectoryClickFromCsv,
  toDirectoryClickCsvLine,
} from "../../lib/founder-directory-clicks-csv";

describe("founder directory clicks CSV", () => {
  it("builds one row per click with profile URL and Cyprus timestamp", () => {
    const line = toDirectoryClickCsvLine(
      {
        clickedAtIso: "2026-08-19T09:41:18.153Z",
        action: "show_phone_number",
        name: "Achilleas Christaki",
        slug: "achilleas-christaki-larnaca",
        specialty: "General Surgery",
        district: "Larnaca",
        source: "finder_card",
      },
      "https://www.mydoccy.com",
    );
    assert.deepEqual(line, [
      "2026-08-19 12:41:18",
      "show_phone_number",
      "Achilleas Christaki",
      "https://www.mydoccy.com/en/achilleas-christaki-larnaca",
      "General Surgery",
      "Larnaca",
      "finder_card",
    ]);
  });

  it("omits test profiles and empty names", () => {
    assert.equal(
      shouldOmitDirectoryClickFromCsv({
        clickedAtIso: "2026-08-19T09:41:18.153Z",
        action: "show_phone_number",
        name: "QA",
        slug: "qa",
        specialty: null,
        district: null,
        source: "finder_card",
        isTestProfile: true,
      }),
      true,
    );
    assert.equal(
      shouldOmitDirectoryClickFromCsv({
        clickedAtIso: "2026-08-19T09:41:18.153Z",
        action: "request_online_appointment",
        name: null,
        slug: null,
        specialty: null,
        district: null,
        source: "finder_card",
      }),
      true,
    );
  });

  it("serializes a BOM CSV and names the file from both table ranges", () => {
    const csv = serializeDirectoryClicksCsv(
      [
        {
          clickedAtIso: "2026-09-02T08:55:44.000Z",
          action: "request_online_appointment",
          name: "Valentina Oflidou",
          slug: "valentina-oflidou-paphos",
          specialty: "Dermato-Venereology",
          district: "Paphos",
          source: "finder_card",
        },
      ],
      "https://www.mydoccy.com",
    );
    assert.equal(csv.startsWith("\uFEFF"), true);
    assert.match(csv, /request_online_appointment,Valentina Oflidou,https:\/\/www\.mydoccy\.com\/en\/valentina-oflidou-paphos/);
    assert.equal(
      directoryClicksCsvFilename({
        action: "show_phone_number",
        callToBookRange: "7d",
        manualVotesRange: "30d",
      }),
      "doccy-show-phone-clicks-7d.csv",
    );
    assert.equal(
      directoryClicksCsvFilename({
        action: "request_online_appointment",
        callToBookRange: "7d",
        manualVotesRange: "30d",
      }),
      "doccy-request-online-clicks-30d.csv",
    );
    assert.equal(
      directoryClickProfileUrl("maria-pap", "https://www.mydoccy.com/"),
      "https://www.mydoccy.com/en/maria-pap",
    );
  });
});
