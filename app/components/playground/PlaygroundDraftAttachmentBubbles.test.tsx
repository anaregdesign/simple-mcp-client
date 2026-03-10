import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SSRProvider } from "@fluentui/react-components";
import { describe, expect, it } from "vitest";
import { PlaygroundDraftAttachmentBubbles } from "./PlaygroundDraftAttachmentBubbles";

describe("PlaygroundDraftAttachmentBubbles", () => {
  it("renders attachment metadata and remove affordances", () => {
    const markup = renderToStaticMarkup(
      <SSRProvider>
        <PlaygroundDraftAttachmentBubbles
          messageAttachments={[
            {
              id: "attachment-1",
              name: "notes.txt",
              sizeBytes: 2048,
            },
          ]}
          isSending={false}
          isThreadReadOnly={false}
          onRemoveMessageAttachment={() => undefined}
        />
      </SSRProvider>,
    );

    expect(markup).toContain("notes.txt");
    expect(markup).toContain("2 KB");
    expect(markup).toContain('aria-label="Remove attachment notes.txt"');
  });
});
