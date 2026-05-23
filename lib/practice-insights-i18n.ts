import en from "@/messages/en.json";
import { createTranslator } from "next-intl";

/** Practice insights is English-only for now (no el.json namespace). */
export function createPracticeInsightsTranslator() {
  return createTranslator({
    locale: "en",
    messages: { PracticeInsights: en.PracticeInsights },
    namespace: "PracticeInsights",
  });
}

export const practiceInsightsClientMessages = {
  PracticeInsights: en.PracticeInsights,
} as const;
