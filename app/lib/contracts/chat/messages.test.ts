import { describe, expect, it } from "vitest";
import { readThreadMessageFromUnknown } from "./messages";

describe("readThreadMessageFromUnknown", () => {
  it("parses valid message payloads through shared attachment and skill parsers", () => {
    expect(
      readThreadMessageFromUnknown({
        id: "assistant-1",
        role: "assistant",
        content: "done",
        createdAt: "2026-03-10T00:00:00.000Z",
        turnId: "turn-1",
        attachments: [
          {
            name: "spec.pdf",
            mimeType: "application/pdf",
            sizeBytes: 42,
            dataUrl: "data:application/pdf;base64,abc",
          },
          {
            name: "",
            mimeType: "application/pdf",
            sizeBytes: 10,
            dataUrl: "data:application/pdf;base64,def",
          },
        ],
        skillActivations: [
          {
            name: "doc-retriever",
            location: "/skills/doc-retriever/SKILL.md",
          },
          {
            name: "duplicate-name",
            location: "/skills/doc-retriever/SKILL.md",
          },
        ],
      }),
    ).toEqual({
      id: "assistant-1",
      role: "assistant",
      content: "done",
      createdAt: "2026-03-10T00:00:00.000Z",
      turnId: "turn-1",
      attachments: [
        {
          name: "spec.pdf",
          mimeType: "application/pdf",
          sizeBytes: 42,
          dataUrl: "data:application/pdf;base64,abc",
        },
      ],
      skillActivations: [
        {
          name: "doc-retriever",
          location: "/skills/doc-retriever/SKILL.md",
        },
      ],
    });
  });

  it("rejects invalid base message fields", () => {
    expect(
      readThreadMessageFromUnknown({
        id: "",
        role: "assistant",
        createdAt: "2026-03-10T00:00:00.000Z",
        turnId: "turn-1",
      }),
    ).toBeNull();
  });
});
