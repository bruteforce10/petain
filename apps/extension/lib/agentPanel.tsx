import { Thread } from "../components/assistant-ui/thread";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";

export function AgentChatTab() {
  const runtime = useChatRuntime({
    api: "/api/chat", // Nanti logika ini diubah saat integrasi dengan background.ts
  });

  return (
    // 👇 bg-white diganti jadi bg-[rgb(250,250,240)] supaya nyatu sama tema luar
    <div className="flex flex-1 h-full w-full flex-col rounded-2xl bg-transparent shadow-sm overflow-hidden">
      <AssistantRuntimeProvider runtime={runtime}>
          <Thread
            welcome={{
              message: "Halo! Saya AI Agent Petain. Beritahu saya apa yang ingin Anda scrape hari ini? (misal: 'Carikan 20 warung tegal di Jakarta Selatan')",
            }}
          />
      </AssistantRuntimeProvider>
    </div>
  );
}
