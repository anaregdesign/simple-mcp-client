import { describe, expect, it } from "vitest";
import {
  cloneThreadAttachment,
  cloneThreadAttachments,
} from "~/lib/domain/value-objects/thread-attachment";

describe("thread-attachment", () => {
  it("clones a single attachment", () => {
    const attachment = {
      name: "notes.txt",
      mimeType: "text/plain",
      sizeBytes: 5,
      dataUrl: "data:text/plain;base64,aGVsbG8=",
    };

    const cloned = cloneThreadAttachment(attachment);

    expect(cloned).toEqual(attachment);
    expect(cloned).not.toBe(attachment);
  });

  it("clones attachment collections defensively", () => {
    const attachments = [
      {
        name: "notes.txt",
        mimeType: "text/plain",
        sizeBytes: 5,
        dataUrl: "data:text/plain;base64,aGVsbG8=",
      },
    ];

    const cloned = cloneThreadAttachments(attachments);
    cloned[0]!.name = "updated.txt";

    expect(attachments[0]!.name).toBe("notes.txt");
  });
});
