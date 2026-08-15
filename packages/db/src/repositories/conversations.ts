import { asc, desc, eq } from "drizzle-orm";
import { generateId, type Conversation, type Message, type MessageRole, type ToolCall } from "@jarvis/shared";
import { getDb } from "../client.js";
import { conversations, messages } from "../schema.js";

export async function createConversation(userId: string, title = "New conversation"): Promise<Conversation> {
  const db = getDb();
  const now = new Date().toISOString();
  const record: Conversation = { id: generateId("conv"), userId, title, createdAt: now, updatedAt: now };
  db.insert(conversations).values(record).run();
  return record;
}

export async function listConversations(userId: string): Promise<Conversation[]> {
  const db = getDb();
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .all() as Conversation[];
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  const db = getDb();
  return db.select().from(conversations).where(eq(conversations.id, id)).get() as Conversation | undefined;
}

export async function addMessage(
  conversationId: string,
  role: MessageRole,
  content: string,
  toolCalls?: ToolCall[],
): Promise<Message> {
  const db = getDb();
  const now = new Date().toISOString();
  const record: Message = { id: generateId("msg"), conversationId, role, content, toolCalls, createdAt: now };
  db.insert(messages).values(record).run();
  db.update(conversations).set({ updatedAt: now }).where(eq(conversations.id, conversationId)).run();
  return record;
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const db = getDb();
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
    .all() as Message[];
}
