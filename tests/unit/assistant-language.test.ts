import { describe, expect, it } from "vitest";
import { buildAssistantNavigationReply } from "@/lib/assistant";
import { detectAssistantLanguage } from "@/lib/assistant-language";
import type { AssistantNavigation } from "@/types/search";

const termsNavigation: AssistantNavigation = {
  kind: "page",
  destination: "terms",
  href: "/terms-and-conditions",
};

describe("assistant query language detection", () => {
  it("uses the query language before the selected storefront locale", () => {
    expect(detectAssistantLanguage("Take me to terms and conditions", "te")).toBe(
      "en",
    );
    expect(detectAssistantLanguage("Do you have earrings?", "te")).toBe("en");
    expect(detectAssistantLanguage("నిబంధనలు పేజీకి తీసుకెళ్లండి", "en")).toBe(
      "te",
    );
  });

  it("recognises Romanized Telugu for typed and voice-equivalent text", () => {
    expect(
      detectAssistantLanguage("nannu terms page ki teesukellandi", "en"),
    ).toBe("te");
  });

  it("falls back to the selected storefront locale for unsupported scripts", () => {
    expect(detectAssistantLanguage("नियमों का पेज खोलो", "te")).toBe("te");
    expect(detectAssistantLanguage("नियमों का पेज खोलो", "en")).toBe("en");
    expect(detectAssistantLanguage("mujhe terms page pe le chalo", "te")).toBe("te");
  });
});

describe("assistant navigation acknowledgement", () => {
  it("uses the detected response language for the spoken and visible acknowledgement", () => {
    expect(
      buildAssistantNavigationReply({
        locale: "en",
        navigation: termsNavigation,
      }),
    ).toMatchObject({
      answer: "Opening terms and conditions.",
      navigation: termsNavigation,
    });

    expect(
      buildAssistantNavigationReply({
        locale: "te",
        navigation: termsNavigation,
      }).answer,
    ).toContain("నిబంధనలు మరియు షరతుల పేజీ");
  });
});
