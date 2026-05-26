import type Anthropic from '@anthropic-ai/sdk';
import { TOOL_DEFS } from './tools';
import { SYSTEM_PROMPT } from './prompts';

/**
 * Tool executor — caller-owned. Receives raw tool name + parsed input,
 * must return a serializable result (or an error string). Errors are
 * forwarded to Claude as is_error tool_result blocks so the model can
 * decide whether to retry or apologize to the user.
 */
export type ToolExecutor = (
  name: string,
  input: Record<string, unknown>,
) => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>;

export type AgentEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_use'; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; name: string; result: { ok: true; data: unknown } | { ok: false; error: string } }
  | { type: 'turn_end'; stop_reason: string | null; usage: Anthropic.Messages.Usage | null }
  | { type: 'error'; error: string };

export interface RunAgentOptions {
  client: Anthropic;
  userMessage: string;
  history?: Anthropic.MessageParam[];
  executeTool: ToolExecutor;
  model?: string;
  maxIterations?: number;
  /**
   * Adaptive thinking — leave undefined for default off; pass 'summarized'
   * to surface reasoning to the chat UI on Opus 4.7.
   */
  thinkingDisplay?: 'omitted' | 'summarized';
}

/**
 * Run a Claude tool-use loop until end_turn or maxIterations is hit.
 * Yields incremental events so the UI can render text streaming + tool
 * status as it happens. Returns the final messages array (caller stores
 * it as conversation history for the next turn).
 */
export async function* runAgent(
  opts: RunAgentOptions,
): AsyncGenerator<AgentEvent, Anthropic.MessageParam[], void> {
  const {
    client,
    userMessage,
    history = [],
    executeTool,
    model = 'claude-sonnet-4-6',
    maxIterations = 8,
    thinkingDisplay,
  } = opts;

  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: 'user', content: `${userMessage}\n\n(Today is ${new Date().toISOString().slice(0, 10)}.)` },
  ];

  for (let iter = 0; iter < maxIterations; iter++) {
    let stream: ReturnType<Anthropic['messages']['stream']>;
    try {
      stream = client.messages.stream({
        model,
        max_tokens: 4096,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: TOOL_DEFS,
        messages,
        ...(thinkingDisplay
          ? { thinking: { type: 'adaptive' as const, display: thinkingDisplay } }
          : {}),
      });
    } catch (e: any) {
      yield { type: 'error', error: e?.message ?? String(e) };
      return messages;
    }

    try {
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield { type: 'text_delta', text: event.delta.text };
        }
      }
    } catch (e: any) {
      yield { type: 'error', error: e?.message ?? String(e) };
      return messages;
    }

    const final = await stream.finalMessage();
    messages.push({ role: 'assistant', content: final.content });

    yield { type: 'turn_end', stop_reason: final.stop_reason, usage: final.usage };

    if (final.stop_reason !== 'tool_use') {
      return messages;
    }

    const toolUses = final.content.filter(
      (b: Anthropic.Messages.ContentBlock): b is Anthropic.Messages.ToolUseBlock =>
        b.type === 'tool_use',
    );
    if (!toolUses.length) return messages;

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      yield {
        type: 'tool_use',
        name: tu.name,
        input: (tu.input as Record<string, unknown>) ?? {},
      };
      const result = await executeTool(tu.name, (tu.input as Record<string, unknown>) ?? {});
      yield { type: 'tool_result', name: tu.name, result };
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify(result.ok ? result.data : { error: result.error }),
        is_error: !result.ok,
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  yield { type: 'error', error: `Hit max iterations (${maxIterations}) without end_turn` };
  return messages;
}
