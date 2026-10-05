"use client";

import { AlertTriangle, Check, CheckCheck, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { sendMessage } from "@/app/actions";
import { useI18n } from "./i18n-provider";

type Msg = { id: string; senderId: string; body: string; flagged: boolean; createdAt: string; readAt: string | null };

export function Chat({ conversationId, userId, initial }: { conversationId: string; userId: string; initial: Msg[] }) {
  const { t, locale } = useI18n();
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const latest = useRef(initial.at(-1)?.createdAt);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]);

  // Poll for new messages; a production build would swap this for websockets/SSE.
  useEffect(() => {
    const tick = async () => {
      const qs = latest.current ? `?after=${encodeURIComponent(latest.current)}` : "";
      const res = await fetch(`/api/messages/${conversationId}${qs}`, { cache: "no-store" }).catch(() => null);
      if (!res?.ok) return;
      const { messages } = (await res.json()) as { messages: Msg[] };
      if (!messages.length) return;
      setMsgs((cur) => {
        const ids = new Set(cur.map((m) => m.id));
        const fresh = messages.filter((m) => !ids.has(m.id));
        return fresh.length ? [...cur, ...fresh] : cur;
      });
      latest.current = messages.at(-1)?.createdAt ?? latest.current;
    };
    const timer = setInterval(tick, 3000);
    return () => clearInterval(timer);
  }, [conversationId]);

  async function send(body: string) {
    if (!body.trim() || sending) return;
    setSending(true);
    const res = await sendMessage(conversationId, body);
    setSending(false);
    if ("message" in res && res.message) {
      const m = { ...res.message, createdAt: new Date(res.message.createdAt).toISOString(), readAt: null };
      setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
      setText("");
    }
  }

  const time = (iso: string) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  return (
    <>
      <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50/60 p-4">
        {msgs.map((m) => {
          const mine = m.senderId === userId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${mine ? "rounded-br-md bg-brand-600 text-white" : "rounded-bl-md bg-white ring-1 ring-slate-200"}`}>
                {m.flagged && !mine && (
                  <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" /> {t.messages.flagged}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-white/70" : "text-slate-400"}`}>
                  {time(m.createdAt)}
                  {mine && (m.readAt ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      {msgs.length === 0 && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 pt-3">
          {t.messages.quick.map((q) => (
            <button key={q} type="button" onClick={() => send(q)} className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100">
              {q}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
        className="flex gap-2 border-t border-slate-100 p-3"
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t.messages.placeholder} className="input" maxLength={2000} />
        <button type="submit" disabled={sending || !text.trim()} className="btn-primary" aria-label={t.messages.send}>
          <Send className="h-4 w-4" />
        </button>
      </form>
    </>
  );
}
