import { describe, expect, it, vi } from "vitest";
import {
  deriveActiveChatCommandMenuState,
  type ChatCommandProvider,
} from "~/lib/client/usecase/workspace/chat-composer/menu-state";

function createProvider(): ChatCommandProvider {
  return {
    keyword: "$",
    emptyHint: "No matching Skills.",
    readSuggestions: (query) => [
      {
        id: `${query}-1`,
        label: `Skill ${query}`,
        description: "Description",
        detail: "Detail",
        isSelected: false,
        isAvailable: true,
      },
      {
        id: `${query}-2`,
        label: `Skill ${query} 2`,
        description: "Description",
        detail: "Detail",
        isSelected: false,
        isAvailable: true,
      },
    ],
    applySuggestion: vi.fn(),
  };
}

describe("deriveActiveChatCommandMenuState", () => {
  it("returns the active menu and clamps the highlighted index", () => {
    const provider = createProvider();

    const result = deriveActiveChatCommandMenuState({
      value: "Run $sk",
      cursorIndex: 7,
      chatCommandProviders: [provider],
      highlightedIndex: 9,
    });

    expect(result.activeChatCommandMatch).toEqual({
      keyword: "$",
      query: "sk",
      rangeStart: 4,
      rangeEnd: 7,
    });
    expect(result.activeChatCommandProvider).toBe(provider);
    expect(result.activeChatCommandSuggestions).toHaveLength(2);
    expect(result.activeChatCommandHighlightIndex).toBe(1);
    expect(result.activeChatCommandMenu).toEqual(
      expect.objectContaining({
        keyword: "$",
        query: "sk",
        highlightedIndex: 1,
      }),
    );
  });

  it("returns an empty state when the cursor is outside a command token", () => {
    const result = deriveActiveChatCommandMenuState({
      value: "Run skill",
      cursorIndex: 3,
      chatCommandProviders: [createProvider()],
      highlightedIndex: 0,
    });

    expect(result.activeChatCommandMatch).toBeNull();
    expect(result.activeChatCommandProvider).toBeNull();
    expect(result.activeChatCommandSuggestions).toEqual([]);
    expect(result.activeChatCommandHighlightIndex).toBe(0);
    expect(result.activeChatCommandMenu).toBeNull();
  });
});
