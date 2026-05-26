export * from '@terramap/types';

/** Popup -> background: start a chat turn. */
export interface AgentChatStart {
  type: 'AGENT_CHAT_START';
  message: string;
}

/** Background -> popup: agent loop event for live rendering. */
export interface AgentStreamEvent {
  type: 'AGENT_STREAM_EVENT';
  event:
    | { kind: 'text_delta'; text: string }
    | { kind: 'tool_use'; name: string; input: Record<string, unknown> }
    | { kind: 'tool_result'; name: string; ok: boolean; summary: string }
    | { kind: 'turn_end' }
    | { kind: 'done' }
    | { kind: 'error'; error: string };
}
