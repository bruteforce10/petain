"use client";

import * as React from "react";
import { Bot, X } from "lucide-react";

import { ChatComposer } from "@/components/agent/ChatComposer";
import { ChatMessageBubble, type ChatMessage } from "@/components/agent/ChatMessageBubble";
import { Card } from "@/components/ui/card";
import type { ChatAttachmentPayload } from "@/lib/ai/chatAttachments";

/**
 * Chat client Agent AI. Riwayat hanya hidup di state client (hilang saat
 * refresh); tiap kirim, client mengirim ulang riwayat terakhir ke
 * POST /api/agent-ai — server stateless.
 */

/** Batas riwayat yang dikirim ke server (server menolak > 30 pesan). */
const MAX_HISTORY_MESSAGES = 20;

const SUGGESTIONS = [
  "Bagaimana cara menentukan harga jual dari HPP?",
  "Ide promosi murah untuk usaha kuliner kecil",
  "Apa yang perlu dicek sebelum memilih lokasi usaha?",
] as const;

async function postAgentChat(messages: ChatMessage[]): Promise<string> {
  const payload = messages.slice(-MAX_HISTORY_MESSAGES).map((message) => ({
    role: message.role,
    text: message.text,
    attachments: message.attachments,
  }));

  const res = await fetch("/api/agent-ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Gagal menghubungi Agent AI. Coba lagi.");
  return data.reply as string;
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div
        aria-label="Agent AI sedang mengetik"
        className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-muted px-4 py-3"
      >
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-300ms]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-150ms]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
      </div>
    </div>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion: (suggestion: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Bot className="size-6" />
      </div>
      <div>
        <p className="font-semibold">Agent AI Petain</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Asisten untuk riset lokasi, analisa pasar, dan HPP. Mulai dari saran di
          bawah atau tulis pertanyaanmu sendiri.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="rounded-full border border-border/70 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => onSuggestion(suggestion)}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AgentAiClient() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, isLoading]);

  async function sendMessage(text: string, attachments: ChatAttachmentPayload[]) {
    if (isLoading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      attachments,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setIsLoading(true);
    setErrorMessage("");

    try {
      const reply = await postAgentChat(nextMessages);
      setMessages([
        ...nextMessages,
        { id: crypto.randomUUID(), role: "model", text: reply, attachments: [] },
      ]);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal menghubungi Agent AI. Coba lagi.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-7.5rem)] min-h-[420px] w-full max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Agent AI</h1>
        <p className="text-sm text-muted-foreground">
          Tanya jawab dengan asisten AI Petain — bisa lampirkan gambar atau file teks
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            aria-label="Tutup pesan error"
            className="shrink-0 rounded p-0.5 hover:bg-destructive/10"
            onClick={() => setErrorMessage("")}
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <EmptyState onSuggestion={(suggestion) => sendMessage(suggestion, [])} />
          ) : (
            messages.map((message) => (
              <ChatMessageBubble key={message.id} message={message} />
            ))
          )}
          {isLoading && <TypingIndicator />}
        </div>
        <ChatComposer isLoading={isLoading} onSend={sendMessage} onError={setErrorMessage} />
      </Card>
    </div>
  );
}
