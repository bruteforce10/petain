import { FileText } from "lucide-react";

import { cn } from "@/lib/utils";
import { MarkdownContent } from "@/components/agent/MarkdownContent";
import type { ChatAttachmentPayload } from "@/lib/ai/chatAttachments";

/**
 * Gelembung pesan chat Agent AI. Pesan user rata kanan dengan warna primary,
 * balasan model rata kiri dengan warna muted — mengikuti gaya dashboard.
 */

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  attachments: ChatAttachmentPayload[];
}

function isImageAttachment(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function AttachmentPreview({ attachment }: { attachment: ChatAttachmentPayload }) {
  if (isImageAttachment(attachment.mimeType)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- pratinjau data URL, bukan asset
      <img
        src={`data:${attachment.mimeType};base64,${attachment.data}`}
        alt={attachment.name}
        className="max-h-48 max-w-full rounded-lg object-contain"
      />
    );
  }
  return (
    <span className="flex items-center gap-1.5 rounded-md bg-background/20 px-2 py-1 text-xs">
      <FileText className="size-3.5 shrink-0" />
      <span className="max-w-48 truncate">{attachment.name}</span>
    </span>
  );
}

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] space-y-2 rounded-2xl px-4 py-2.5 text-sm",
          isUser
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md bg-muted text-foreground",
        )}
      >
        {message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.attachments.map((attachment, index) => (
              <AttachmentPreview key={`${attachment.name}-${index}`} attachment={attachment} />
            ))}
          </div>
        )}
        {message.text &&
          (isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.text}</p>
          ) : (
            <MarkdownContent text={message.text} />
          ))}
      </div>
    </div>
  );
}
