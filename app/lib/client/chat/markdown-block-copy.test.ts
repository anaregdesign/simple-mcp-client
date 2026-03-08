import { describe, expect, it } from "vitest";
import { readMarkdownBlockCopyText, type MarkdownBlockNode } from "./markdown-block-copy";

describe("readMarkdownBlockCopyText", () => {
  it("reads code blocks without markdown fences", () => {
    const node: MarkdownBlockNode = {
      type: "element",
      tagName: "pre",
      children: [
        {
          type: "element",
          tagName: "code",
          children: [
            {
              type: "text",
              value: "const value = 1;\nconsole.log(value);\n",
            },
          ],
        },
      ],
    };

    expect(readMarkdownBlockCopyText(node)).toBe("const value = 1;\nconsole.log(value);");
  });

  it("keeps inline markdown text on the same line", () => {
    const node: MarkdownBlockNode = {
      type: "element",
      tagName: "blockquote",
      children: [
        {
          type: "element",
          tagName: "p",
          children: [
            { type: "text", value: "Hello " },
            {
              type: "element",
              tagName: "strong",
              children: [{ type: "text", value: "world" }],
            },
            { type: "text", value: "!" },
          ],
        },
      ],
    };

    expect(readMarkdownBlockCopyText(node)).toBe("Hello world!");
  });

  it("formats markdown tables into tab-separated text", () => {
    const node: MarkdownBlockNode = {
      type: "element",
      tagName: "table",
      children: [
        {
          type: "element",
          tagName: "thead",
          children: [
            {
              type: "element",
              tagName: "tr",
              children: [
                {
                  type: "element",
                  tagName: "th",
                  children: [{ type: "text", value: "Name" }],
                },
                {
                  type: "element",
                  tagName: "th",
                  children: [{ type: "text", value: "Role" }],
                },
              ],
            },
          ],
        },
        {
          type: "element",
          tagName: "tbody",
          children: [
            {
              type: "element",
              tagName: "tr",
              children: [
                {
                  type: "element",
                  tagName: "td",
                  children: [{ type: "text", value: "Alice" }],
                },
                {
                  type: "element",
                  tagName: "td",
                  children: [{ type: "text", value: "Owner" }],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(readMarkdownBlockCopyText(node)).toBe("Name\tRole\nAlice\tOwner");
  });

  it("formats ordered lists with list markers", () => {
    const node: MarkdownBlockNode = {
      type: "element",
      tagName: "ol",
      children: [
        {
          type: "element",
          tagName: "li",
          children: [
            {
              type: "element",
              tagName: "p",
              children: [{ type: "text", value: "First" }],
            },
          ],
        },
        {
          type: "element",
          tagName: "li",
          children: [
            {
              type: "element",
              tagName: "p",
              children: [{ type: "text", value: "Second" }],
            },
          ],
        },
      ],
    };

    expect(readMarkdownBlockCopyText(node)).toBe("1. First\n2. Second");
  });
});
