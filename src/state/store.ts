import { pickReply, SEED_CONVERSATIONS } from "../data/replies";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Still receiving tokens — the renderer shows a cursor after the text. */
  streaming?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface ChatState {
  conversations: Conversation[];
  /** `null` renders the new-chat empty state. */
  activeId: string | null;
  streaming: boolean;
}

let nextId = 1;
const id = (prefix: string) => `${prefix}-${nextId++}`;

function seed(): Conversation[] {
  const now = Date.now();
  return SEED_CONVERSATIONS.map((entry, index) => ({
    id: id("c"),
    title: entry.title,
    messages: [
      { id: id("m"), role: "user" as const, text: entry.user },
      { id: id("m"), role: "assistant" as const, text: entry.body },
    ],
    updatedAt: now - (index + 1) * 3_600_000,
  }));
}

let state: ChatState = {
  conversations: seed(),
  activeId: null,
  streaming: false,
};

const listeners = new Set<() => void>();

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getState(): ChatState {
  return state;
}

function setState(patch: Partial<ChatState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function updateConversation(convId: string, update: (c: Conversation) => Conversation): void {
  setState({
    conversations: state.conversations.map((c) => (c.id === convId ? update(c) : c)),
  });
}

export function activeConversation(s: ChatState = state): Conversation | null {
  return s.conversations.find((c) => c.id === s.activeId) ?? null;
}

// ---------------------------------------------------------------------------
// Streaming

let streamTimer: ReturnType<typeof setTimeout> | null = null;

function clearStream(): void {
  if (streamTimer !== null) {
    clearTimeout(streamTimer);
    streamTimer = null;
  }
}

/** Words arrive in small bursts on an organic cadence, like a live model. */
function streamInto(convId: string, messageId: string, body: string): void {
  const tokens = body.split(/(\s+)/);
  let cursor = 0;

  const tick = () => {
    // Words per burst: mostly 2-4, occasionally a longer run.
    const burst = 2 + Math.floor(Math.random() * 3) + (Math.random() < 0.12 ? 6 : 0);
    let taken = 0;
    while (cursor < tokens.length && taken < burst) {
      if (tokens[cursor].trim() !== "") taken++;
      cursor++;
    }
    const text = tokens.slice(0, cursor).join("");
    const done = cursor >= tokens.length;
    updateConversation(convId, (c) => ({
      ...c,
      updatedAt: Date.now(),
      messages: c.messages.map((m) =>
        m.id === messageId ? { ...m, text, streaming: !done } : m,
      ),
    }));
    if (done) {
      streamTimer = null;
      setState({ streaming: false });
      return;
    }
    streamTimer = setTimeout(tick, 26 + Math.random() * 40);
  };

  streamTimer = setTimeout(tick, 450 + Math.random() * 350);
}

// ---------------------------------------------------------------------------
// Actions

export function newChat(): void {
  stopStreaming();
  setState({ activeId: null });
}

export function openChat(convId: string): void {
  stopStreaming();
  setState({ activeId: convId });
}

export function deleteConversation(convId: string): void {
  if (state.activeId === convId) stopStreaming();
  setState({
    conversations: state.conversations.filter((c) => c.id !== convId),
    activeId: state.activeId === convId ? null : state.activeId,
  });
}

export function sendMessage(text: string): void {
  const trimmed = text.trim();
  if (trimmed === "" || state.streaming) return;

  const reply = pickReply(trimmed);
  const userMessage: ChatMessage = { id: id("m"), role: "user", text: trimmed };
  const assistantMessage: ChatMessage = {
    id: id("m"),
    role: "assistant",
    text: "",
    streaming: true,
  };

  let convId = state.activeId;
  if (convId === null) {
    const conversation: Conversation = {
      id: id("c"),
      title: reply.title,
      messages: [userMessage, assistantMessage],
      updatedAt: Date.now(),
    };
    convId = conversation.id;
    setState({
      conversations: [conversation, ...state.conversations],
      activeId: convId,
      streaming: true,
    });
  } else {
    setState({ streaming: true });
    updateConversation(convId, (c) => ({
      ...c,
      updatedAt: Date.now(),
      messages: [...c.messages, userMessage, assistantMessage],
    }));
  }

  streamInto(convId, assistantMessage.id, reply.body);
}

export function stopStreaming(): void {
  if (!state.streaming && streamTimer === null) return;
  clearStream();
  const conversation = activeConversation();
  if (conversation !== null) {
    updateConversation(conversation.id, (c) => ({
      ...c,
      messages: c.messages.map((m) => (m.streaming ? { ...m, streaming: false } : m)),
    }));
  }
  setState({ streaming: false });
}
