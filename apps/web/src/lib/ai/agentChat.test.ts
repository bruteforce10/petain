import { describe, expect, test } from "bun:test";

import { buildGeminiContents, type AgentChatMessage } from "./agentChat";

function base64(text: string): string {
  return Buffer.from(text, "utf-8").toString("base64");
}

describe("buildGeminiContents", () => {
  test("maps user and model roles with text parts", () => {
    const messages: AgentChatMessage[] = [
      { role: "user", text: "halo" },
      { role: "model", text: "hai, ada yang bisa dibantu?" },
    ];

    const contents = buildGeminiContents(messages);

    expect(contents).toEqual([
      { role: "user", parts: [{ text: "halo" }] },
      { role: "model", parts: [{ text: "hai, ada yang bisa dibantu?" }] },
    ]);
  });

  test("sends images as inlineData after the text part", () => {
    const messages: AgentChatMessage[] = [
      {
        role: "user",
        text: "analisa foto ini",
        attachments: [{ name: "foto.png", mimeType: "image/png", data: "aGFsbG8=" }],
      },
    ];

    const [content] = buildGeminiContents(messages);

    expect(content.parts).toEqual([
      { text: "analisa foto ini" },
      { inlineData: { data: "aGFsbG8=", mimeType: "image/png" } },
    ]);
  });

  test("decodes text attachments into a labelled text part", () => {
    const messages: AgentChatMessage[] = [
      {
        role: "user",
        text: "ringkas file ini",
        attachments: [
          { name: "notes.txt", mimeType: "text/plain", data: base64("isi catatan") },
        ],
      },
    ];

    const [content] = buildGeminiContents(messages);
    const fileParts = content.parts.filter(
      (part): part is { text: string } => "text" in part && part.text !== "ringkas file ini",
    );

    expect(fileParts).toHaveLength(1);
    expect(fileParts[0].text).toContain("notes.txt");
    expect(fileParts[0].text).toContain("isi catatan");
  });

  test("omits empty text part when message only has attachments", () => {
    const messages: AgentChatMessage[] = [
      {
        role: "user",
        text: "",
        attachments: [{ name: "foto.png", mimeType: "image/png", data: "aGFsbG8=" }],
      },
    ];

    const [content] = buildGeminiContents(messages);

    expect(content.parts).toEqual([
      { inlineData: { data: "aGFsbG8=", mimeType: "image/png" } },
    ]);
  });
});
