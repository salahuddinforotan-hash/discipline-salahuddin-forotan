import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowUp,
  CalendarClock,
  Check,
  LayoutDashboard,
  MessageSquarePlus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";

import { api, appDataUpdatedEventName } from "../services/api";
import type { AIConversation, AIAction } from "../services/api";

type Message = {
  id: number | string;
  role: "assistant" | "user";
  content: string;
  action?: AIAction | null;
  actionDismissed?: boolean;
  actionCreated?: boolean;
};

let localMessageId = 1_000_000;

const suggestions = [
  "What should I focus on today?",
  "How are my habits this week?",
  "How much did I spend this month?",
  "Am I staying within my budget?",
  "What are my most important goals?",
  "What have I been learning recently?",
  "Give me a summary of my week.",
];

export default function Assistant() {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof api.getAIStatus>> | null>(null);
  const [statusError, setStatusError] = useState("");
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setStatusError("");
      setStatus(await api.getAIStatus());
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Could not load AI status.");
    }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await api.getAIConversations());
    } catch {
      setConversations([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    void loadConversations();
  }, [loadStatus, loadConversations]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, sending]);

  const openConversation = useCallback(async (id: number) => {
    setConversationId(id);
    setChatError("");
    try {
      const records = await api.getAIMessages(id);
      setMessages(records.map((record) => ({ id: record.id, role: record.role, content: record.content })));
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Could not load messages.");
    }
  }, []);

  function startNewConversation() {
    setConversationId(null);
    setMessages([]);
    setChatError("");
  }

  async function sendMessage(text: string) {
    const content = text.trim();
    if (!content || sending) return;
    setChatError("");
    setLastPrompt(content);
    const userMessageId = localMessageId++;
    setMessages((current) => [...current, { id: userMessageId, role: "user", content }]);
    setDraft("");
    setSending(true);
    try {
      const response = await api.sendAIChat({ message: content, conversation_id: conversationId });
      setConversationId(response.conversation_id);
      setMessages((current) => [
        ...current,
        { id: localMessageId++, role: "assistant", content: response.reply, action: response.action },
      ]);
      void loadConversations();
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== userMessageId));
      setDraft(content);
      setChatError(error instanceof Error ? error.message : "The AI request failed.");
    } finally {
      setSending(false);
    }
  }

  async function retryLast() {
    if (lastPrompt) {
      await sendMessage(lastPrompt);
    }
  }

  async function showInsight(kind: "daily" | "weekly") {
    setChatError("");
    setSending(true);
    try {
      const result = kind === "daily" ? await api.getAIDailyBriefing() : await api.getAIWeeklyReview();
      setMessages((current) => [
        ...current,
        { id: localMessageId++, role: "assistant", content: result.message },
      ]);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Could not generate the summary.");
    } finally {
      setSending(false);
    }
  }

  async function deleteConversation(id: number) {
    try {
      await api.deleteAIConversation(id);
      if (conversationId === id) startNewConversation();
      void loadConversations();
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Could not delete the conversation.");
    }
  }

  async function clearCurrentConversation() {
    if (conversationId !== null) {
      await deleteConversation(conversationId);
    } else {
      setMessages([]);
    }
  }

  function dismissAction(messageId: number | string) {
    setMessages((current) =>
      current.map((message) => (message.id === messageId ? { ...message, actionDismissed: true } : message)),
    );
  }

  async function confirmAction(message: Message) {
    if (!message.action) return;
    try {
      await api.executeAICreateTask({
        title: message.action.title,
        due_date: message.action.due_date ?? null,
        due_time: message.action.due_time ?? null,
      });
      setMessages((current) =>
        current.map((item) => (item.id === message.id ? { ...item, actionCreated: true } : item)),
      );
      window.dispatchEvent(new Event(appDataUpdatedEventName));
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Could not create the task.");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(draft);
    }
  }

  const configured = status?.configured === true;

  return (
    <section className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-violet-300">
            <Sparkles size={15} /> DISCIPLINE INTELLIGENCE
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">AI Assistant</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400 sm:text-base">
            Your personal assistant for your Discipline App, answering from your real tasks, goals, habits, learning, finance, and journal data.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => { void loadStatus(); void loadConversations(); }}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/[0.07]"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          {status && (
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
              configured
                ? status.local
                  ? "border-emerald-300/15 bg-emerald-300/[0.07] text-emerald-200"
                  : "border-sky-300/15 bg-sky-300/[0.07] text-sky-200"
                : "border-amber-300/15 bg-amber-300/[0.07] text-amber-200"
            }`}>
              {configured
                ? `${status.provider} · ${status.model}${status.local ? " · local" : ""}`
                : "Local guidance"}
            </div>
          )}
        </div>
      </header>

      {statusError && (
        <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-300/[0.08] px-3 py-2 text-xs text-rose-200">
          {statusError}
        </p>
      )}

      {status && !configured && (
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-5">
          <h2 className="text-sm font-semibold text-amber-100">Local assistant mode is ready.</h2>
          <p className="mt-1 text-sm leading-6 text-amber-100/80">
            You can send messages now and get summaries from your saved tasks, goals, habits, learning plans, and finance records. {status.message} A server administrator must connect a provider for full AI conversations and task creation; API keys stay on the server.
          </p>
          <Link to="/settings/ai" className="mt-3 inline-flex items-center rounded-lg border border-amber-100/15 bg-amber-100/[0.06] px-3 py-2 text-xs font-medium text-amber-50 transition hover:bg-amber-100/[0.1]">
            Open AI settings
          </Link>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <button
            type="button"
            onClick={startNewConversation}
            className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-slate-200 transition hover:bg-white/[0.07]"
          >
            <MessageSquarePlus size={15} /> New conversation
          </button>
          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <h2 className="text-sm font-semibold text-white">History</h2>
            {loadingHistory && <p className="mt-2 text-xs text-slate-500">Loading…</p>}
            {!loadingHistory && conversations.length === 0 && (
              <p className="mt-2 text-xs text-slate-500">No previous conversations.</p>
            )}
            <ul className="mt-2 space-y-1">
              {conversations.map((conversation) => (
                <li key={conversation.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void openConversation(conversation.id)}
                    className={`flex-1 truncate rounded-lg px-2 py-1.5 text-left text-xs transition ${
                      conversationId === conversation.id ? "bg-white/[0.08] text-white" : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                    }`}
                  >
                    {conversation.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteConversation(conversation.id)}
                    aria-label="Delete conversation"
                    className="rounded p-1 text-slate-600 opacity-0 transition hover:text-rose-300 group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <h2 className="text-sm font-semibold text-white">Insights</h2>
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                disabled={sending}
                onClick={() => void showInsight("daily")}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/[0.05] disabled:opacity-50"
              >
                <CalendarClock size={14} /> Daily briefing
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={() => void showInsight("weekly")}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/[0.05] disabled:opacity-50"
              >
                <LayoutDashboard size={14} /> Weekly review
              </button>
            </div>
          </section>
        </aside>

        <article className="flex min-h-[600px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-sm font-semibold text-white">Discipline Assistant</h2>
              <p className="text-xs text-slate-500">
                {status?.local
                  ? "Self-hosted Ollama — your data stays on your configured server."
                  : configured
                    ? "External AI provider in use — relevant summaries of your data are sent to it."
                    : "Local guided replies use your app records. Connect a model for open-ended AI replies."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void clearCurrentConversation()}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
            >
              Clear conversation
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <Sparkles size={28} className="text-violet-300" />
                <h3 className="mt-4 text-lg font-semibold text-white">What would you like to know?</h3>
                <p className="mt-1 max-w-md text-sm text-slate-500">
                  Ask about your day, habits, goals, learning, or finances. Answers are built from your records.
                </p>
              </div>
            )}
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                {message.role === "assistant" && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-400/10 text-violet-200">
                    <Sparkles size={15} />
                  </span>
                )}
                <div className="max-w-[88%] space-y-3">
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === "user"
                      ? "rounded-br-md bg-violet-300 text-slate-950"
                      : "rounded-bl-md border border-white/[0.07] bg-slate-900/80 text-slate-200"
                  }`}>
                    <p data-no-translate className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                  {message.action && !message.actionDismissed && (
                    <div className="rounded-xl border border-violet-300/20 bg-violet-300/[0.06] p-4">
                      <p className="text-xs font-medium text-violet-200">Suggested action</p>
                      <p className="mt-1 text-sm text-white">Create task: “{message.action.title}”</p>
                      {(message.action.due_date || message.action.due_time) && (
                        <p className="text-xs text-slate-400">
                          {message.action.due_date ?? "No due date"}
                          {message.action.due_time ? ` at ${message.action.due_time}` : ""}
                        </p>
                      )}
                      {!message.actionCreated ? (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => dismissAction(message.id)}
                            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.05]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void confirmAction(message)}
                            className="rounded-lg bg-violet-300 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-violet-200"
                          >
                            Create Task
                          </button>
                        </div>
                      ) : (
                        <p className="mt-2 flex items-center gap-1 text-xs text-emerald-300">
                          <Check size={13} /> Task created.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-400/10 text-violet-200">
                  <Sparkles size={15} />
                </span>
                Thinking…
              </div>
            )}
            <div ref={messageEndRef} />
          </div>

          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2 px-4 pb-4 sm:px-6">
              {suggestions.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={sending}
                  onClick={() => void sendMessage(prompt)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:border-violet-300/30 hover:text-white disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {chatError && (
            <div className="mx-4 mb-3 flex items-center justify-between gap-3 rounded-lg border border-rose-300/20 bg-rose-300/[0.08] px-3 py-2 sm:mx-6">
              <p role="alert" className="flex items-center gap-2 text-xs text-rose-200">
                <AlertCircle size={14} /> {chatError}
              </p>
              {lastPrompt && (
                <button type="button" onClick={() => void retryLast()} className="text-xs font-medium text-rose-100 underline">
                  Retry
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="border-t border-white/10 p-4 sm:p-5">
            <div className="flex items-end gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-2 focus-within:border-violet-300/30">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sending}
                rows={1}
                maxLength={1000}
                aria-label="Ask the assistant"
                placeholder="Ask about your day, tasks, goals, habits, learning, or finances…"
                className="max-h-32 min-h-10 flex-1 resize-y bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-slate-600 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                aria-label="Send message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-300 text-slate-950 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowUp size={18} />
              </button>
            </div>
            <p className="mt-2 px-1 text-[11px] text-slate-600">Enter to send · Shift + Enter for a new line</p>
          </form>
        </article>
      </div>
    </section>
  );
}
