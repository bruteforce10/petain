import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { AgentChatStart, AgentStreamEvent } from '@/lib/types';

interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  // Tool calls + results rendered inline under the assistant turn.
  toolLog: { name: string; status: 'running' | 'done' | 'error'; summary?: string }[];
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authErr, setAuthErr] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [authBusy, setAuthBusy] = useState(false);

  const [apiKey, setApiKey] = useState('');
  const [apiKeyShown, setApiKeyShown] = useState(false);

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const turnsRef = useRef(turns);
  turnsRef.current = turns;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    chrome.storage.local.get('anthropic_api_key').then((r) => {
      const k = (r.anthropic_api_key as string) ?? '';
      if (k) setApiKey(k);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function saveApiKey() {
    await chrome.storage.local.set({ anthropic_api_key: apiKey.trim() });
    setApiKeyShown(false);
  }

  useEffect(() => {
    const listener = (msg: AgentStreamEvent) => {
      if (msg?.type !== 'AGENT_STREAM_EVENT') return;
      const e = msg.event;
      setTurns((prev) => {
        const copy = [...prev];
        let last = copy[copy.length - 1];
        if (!last || last.role !== 'assistant') {
          last = { role: 'assistant', text: '', toolLog: [] };
          copy.push(last);
        } else {
          last = { ...last, toolLog: [...last.toolLog] };
          copy[copy.length - 1] = last;
        }
        if (e.kind === 'text_delta') {
          last.text += e.text;
        } else if (e.kind === 'tool_use') {
          last.toolLog.push({ name: e.name, status: 'running' });
        } else if (e.kind === 'tool_result') {
          const idx = last.toolLog.findLastIndex(
            (t) => t.name === e.name && t.status === 'running',
          );
          if (idx >= 0) {
            last.toolLog[idx] = {
              name: e.name,
              status: e.ok ? 'done' : 'error',
              summary: e.summary,
            };
          }
        } else if (e.kind === 'done' || e.kind === 'error') {
          if (e.kind === 'error') last.text += `\n\n[error: ${e.error}]`;
          setBusy(false);
        }
        return copy;
      });
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  async function send() {
    if (!input.trim() || busy) return;
    if (!apiKey) {
      setApiKeyShown(true);
      return;
    }
    const text = input.trim();
    setInput('');
    setBusy(true);
    setTurns((prev) => [...prev, { role: 'user', text, toolLog: [] }]);
    const msg: AgentChatStart = { type: 'AGENT_CHAT_START', message: text };
    chrome.runtime.sendMessage(msg).catch((e) => {
      setBusy(false);
      setTurns((prev) => [
        ...prev,
        { role: 'assistant', text: `[send error: ${e?.message ?? e}]`, toolLog: [] },
      ]);
    });
  }

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthErr('');
    setAuthBusy(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) setAuthErr(error.message);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setAuthErr(error.message);
      }
    } finally {
      setAuthBusy(false);
    }
  }

  if (!session) {
    return (
      <div className="p-4 space-y-3">
        <h1 className="text-base font-bold">TerraMap Agent</h1>
        <p className="text-xs text-gray-500">Varian D — AI agent</p>
        <form onSubmit={submitAuth} className="space-y-2">
          <input
            className="w-full border rounded px-2 py-1 text-sm"
            type="email" placeholder="email" value={email}
            onChange={(e) => setEmail(e.target.value)} required
          />
          <input
            className="w-full border rounded px-2 py-1 text-sm"
            type="password" placeholder="password" value={password} minLength={6}
            onChange={(e) => setPassword(e.target.value)} required
          />
          <button
            className="w-full bg-blue-600 disabled:bg-gray-400 text-white rounded py-1 text-sm"
            type="submit" disabled={authBusy}
          >
            {authBusy ? 'Working…' : mode === 'signup' ? 'Sign up' : 'Log in'}
          </button>
          {authErr && <p className="text-red-600 text-xs">{authErr}</p>}
        </form>
        <button
          className="text-xs text-blue-600 underline"
          onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setAuthErr(''); }}
        >
          {mode === 'signup' ? 'Already have an account? Log in' : 'No account? Sign up'}
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      <div className="flex justify-between items-center">
        <h1 className="text-base font-bold">TerraMap Agent</h1>
        <div className="flex gap-2">
          <button
            className="text-xs text-gray-500 underline"
            onClick={() => setApiKeyShown(!apiKeyShown)}
          >
            api key
          </button>
          <button
            className="text-xs text-gray-500 underline"
            onClick={() => supabase.auth.signOut()}
          >
            logout
          </button>
        </div>
      </div>

      {apiKeyShown && (
        <div className="border rounded p-2 space-y-1 bg-yellow-50">
          <p className="text-xs text-gray-700">
            Anthropic API key. Stored in chrome.storage.local. Never leaves your browser.
          </p>
          <input
            className="w-full border rounded px-2 py-1 text-xs font-mono"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
          />
          <button
            className="text-xs bg-blue-600 text-white rounded px-2 py-1"
            onClick={saveApiKey}
          >
            save
          </button>
        </div>
      )}

      <div className="border rounded p-2 h-80 overflow-y-auto space-y-3 bg-gray-50">
        {turns.length === 0 && (
          <p className="text-xs text-gray-500">
            Try: "Cari coffee shop di Dago radius 1.5km, kasih analisa kompetitor & estimasi market size."
          </p>
        )}
        {turns.map((t, i) => (
          <div key={i} className={t.role === 'user' ? 'text-right' : ''}>
            <div
              className={`inline-block max-w-full text-sm whitespace-pre-wrap rounded px-2 py-1 ${
                t.role === 'user' ? 'bg-blue-100' : 'bg-white border'
              }`}
            >
              {t.text || (t.role === 'assistant' && busy ? '…' : '')}
            </div>
            {t.toolLog.length > 0 && (
              <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                {t.toolLog.map((tl, j) => (
                  <div key={j}>
                    {tl.status === 'running' ? '⏳' : tl.status === 'done' ? '✓' : '✗'}{' '}
                    <span className="font-mono">{tl.name}</span>
                    {tl.summary && <span className="text-gray-400"> — {tl.summary}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-1">
        <input
          className="flex-1 border rounded px-2 py-1 text-sm"
          placeholder="Tanya apapun…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={busy}
        />
        <button
          className="bg-green-600 disabled:bg-gray-400 text-white rounded px-3 text-sm"
          onClick={send}
          disabled={busy || !input.trim()}
        >
          {busy ? '…' : '↑'}
        </button>
      </div>
    </div>
  );
}
