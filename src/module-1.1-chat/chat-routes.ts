import type { Env } from '../env';
import { errorJson, json } from '../lib/http';
import { runGeminiConversation } from './providers/gemini';
import { runOpenAiCompatConversation } from './providers/openai-compat';
import type { ChatMessage, ChatProvider, ChatTurnResult, ToolCaller } from './types';

const OPENAI_BASE_URL = 'https://api.openai.com/v1';
type ChatRequest = { message: string; history?: ChatMessage[]; provider?: ChatProvider; model?: string };
export function resolveProvider(value: string | undefined, env: Env): ChatProvider { const p = value || env.DEFAULT_CHAT_PROVIDER; return p === 'openai' || p === 'openai-compat' ? p : 'gemini'; }
export function defaultModelFor(provider: ChatProvider, env: Env): string { return provider === 'gemini' ? env.GEMINI_MODEL || 'gemini-flash-latest' : provider === 'openai' ? env.OPENAI_MODEL || 'gpt-4o-mini' : env.OPENAI_COMPAT_MODEL || 'gpt-4o-mini'; }
export function buildSystemPrompt(hasTools = false): string { return `คุณคือผู้ช่วย AI ภาษาไทยที่สุภาพและช่วยเหลือได้จริง ตอบให้ชัดเจน กระชับ และไม่อ้างว่าทำสิ่งที่ทำไม่ได้${hasTools ? ' หากมีเครื่องมือ ให้เลือกใช้เมื่อเหมาะสม' : ''}`; }
export async function resolveApiKey(env: Env, provider: ChatProvider): Promise<string> { return provider === 'gemini' ? env.GEMINI_API_KEY || '' : provider === 'openai' ? env.OPENAI_API_KEY || '' : env.OPENAI_COMPAT_API_KEY || ''; }
export async function resolveBaseUrl(env: Env, provider: ChatProvider): Promise<string> { const baseUrl = env.OPENAI_COMPAT_BASE_URL?.trim(); return provider === 'openai' ? OPENAI_BASE_URL : provider === 'openai-compat' && baseUrl && baseUrl !== 'Replace base url' ? baseUrl : ''; }
export async function resolveTools(_env: Env): Promise<{ tools: never[]; callTool: ToolCaller }> { return { tools: [], callTool: async () => { throw new Error('ยังไม่รองรับ MCP tools ใน Module 1.1'); } }; }
export async function runProvider(provider: ChatProvider, params: { history: ChatMessage[]; tools: never[]; apiKey: string; baseUrl: string; model: string; systemPrompt: string; callTool: ToolCaller }): Promise<ChatTurnResult> { return provider === 'gemini' ? runGeminiConversation(params) : runOpenAiCompatConversation(params); }
export async function runChatTurn(params: { env: Env; provider: ChatProvider; model?: string; history: ChatMessage[] }): Promise<{ reply: string; toolTraceCount: number }> { const provider = resolveProvider(params.provider, params.env); const model = params.model?.trim() || defaultModelFor(provider, params.env); const [apiKey, baseUrl, { tools, callTool }] = await Promise.all([resolveApiKey(params.env, provider), resolveBaseUrl(params.env, provider), resolveTools(params.env)]); const result = await runProvider(provider, { history: params.history, tools, apiKey, baseUrl, model, systemPrompt: buildSystemPrompt(false), callTool }); return { reply: result.reply, toolTraceCount: result.toolTrace.length }; }

export async function handleChatRoute(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return errorJson('รองรับเฉพาะ POST /api/chat', 405);
  let body: ChatRequest; try { body = await request.json() as ChatRequest; } catch { return errorJson('รูปแบบ JSON ไม่ถูกต้อง'); }
  if (!body || typeof body.message !== 'string' || !body.message.trim()) return errorJson('กรุณาระบุ message');
  const history = Array.isArray(body.history) ? body.history.filter((m): m is ChatMessage => !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-40) : [];
  history.push({ role: 'user', content: body.message.trim() }); const provider = resolveProvider(body.provider, env); const model = body.model?.trim() || defaultModelFor(provider, env);
  try { const [apiKey, baseUrl, { tools, callTool }] = await Promise.all([resolveApiKey(env, provider), resolveBaseUrl(env, provider), resolveTools(env)]); const result = await runProvider(provider, { history, tools, apiKey, baseUrl, model, systemPrompt: buildSystemPrompt(false), callTool }); return json({ reply: result.reply, provider, model, toolTrace: result.toolTrace }); } catch (error) { return errorJson(error instanceof Error ? error.message : 'เกิดข้อผิดพลาดระหว่างประมวลผล', 502); }
}