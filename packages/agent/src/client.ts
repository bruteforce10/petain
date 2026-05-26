import Anthropic from '@anthropic-ai/sdk';

export interface AgentClientOptions {
  apiKey: string;
  /**
   * Anthropic SDK refuses to run in a browser-like environment by default
   * because exposing an API key in client code is unsafe. In a Chrome MV3
   * service worker the key still lives client-side, so the user is opting
   * in by storing one in chrome.storage. Caller must own that warning.
   */
  dangerouslyAllowBrowser?: boolean;
}

export function createAgentClient(opts: AgentClientOptions): Anthropic {
  return new Anthropic({
    apiKey: opts.apiKey,
    dangerouslyAllowBrowser: opts.dangerouslyAllowBrowser ?? true,
  });
}

export { Anthropic };
