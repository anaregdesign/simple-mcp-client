/**
 * Test module verifying request metadata helpers.
 */
import { describe, expect, it } from "vitest";
import {
  readOptionalRequestHeaderValue,
  readRegionCodeFromLanguageTag,
  readWebSearchUserLocationFromRequest,
  wantsEventStream,
} from "~/lib/server/infrastructure/gateways/chat/request-metadata";

describe("wantsEventStream", () => {
  it("returns true when accept header includes text/event-stream", () => {
    const request = new Request("http://localhost/api/chat", {
      headers: {
        accept: "text/event-stream, application/json",
      },
    });
    expect(wantsEventStream(request)).toBe(true);
  });

  it("returns false when accept header is missing", () => {
    const request = new Request("http://localhost/api/chat");
    expect(wantsEventStream(request)).toBe(false);
  });
});

describe("readOptionalRequestHeaderValue", () => {
  it("returns normalized value when header exists", () => {
    const request = new Request("http://localhost/api/chat", {
      headers: {
        "x-test-header": "  value  ",
      },
    });
    expect(readOptionalRequestHeaderValue(request, "x-test-header")).toBe("value");
  });

  it("returns null when value is empty", () => {
    const request = new Request("http://localhost/api/chat", {
      headers: {
        "x-test-header": "   ",
      },
    });
    expect(readOptionalRequestHeaderValue(request, "x-test-header")).toBeNull();
  });
});

describe("readRegionCodeFromLanguageTag", () => {
  it("reads region from valid language tags", () => {
    expect(readRegionCodeFromLanguageTag("ja-JP")).toBe("JP");
    expect(readRegionCodeFromLanguageTag("en-us")).toBe("US");
  });

  it("returns null for tags without valid regions", () => {
    expect(readRegionCodeFromLanguageTag("ja")).toBeNull();
    expect(readRegionCodeFromLanguageTag("en-001")).toBeNull();
  });
});

describe("readWebSearchUserLocationFromRequest", () => {
  it("parses country from accept-language header", () => {
    const request = new Request("http://localhost/api/chat", {
      headers: {
        "accept-language": "ja-JP,ja;q=0.9,en-US;q=0.8",
      },
    });
    expect(readWebSearchUserLocationFromRequest(request)).toEqual({
      type: "approximate",
      country: "JP",
    });
  });

  it("returns null when region cannot be inferred", () => {
    const request = new Request("http://localhost/api/chat", {
      headers: {
        "accept-language": "ja,en;q=0.8",
      },
    });
    expect(readWebSearchUserLocationFromRequest(request)).toBeNull();
  });
});
