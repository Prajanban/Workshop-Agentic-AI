import { toGeminiSchema } from '../tool-schema';
import type { ChatMessage, ChatTurnResult, McpTool, ToolCaller, ToolTraceEntry } from '../types';

const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models';
export async function runGeminiConversation(params: { apiKey: string; model: string; history: ChatMessage[]; systemPrompt: string; tools: McpTool[]; callTool: ToolCaller }): Promise<ChatTurnResult> {
  if (!params.apiKey) return { reply: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY กรุณาตั้งค่าใน Cloudflare ก่อนใช้งาน Gemini', toolTrace: [] };
  const contents: any[] = params.history.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const trace: ToolTraceEntry[] = [];
  for (let round = 0; round < 4; round++) {
    const body: any = { system_instruction: { parts: [{ text: params.systemPrompt }] }, contents };
    if (params.tools.length) body.tools = [{ function_declarations: params.tools.map((t) => ({ name: `${t.serverId}__${t.name}`, description: t.description, parameters: toGeminiSchema(t.inputSchema) })) }];
    const response = await fetch(`${endpoint}/${encodeURIComponent(params.model)}:generateContent?key=${encodeURIComponent(params.apiKey)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) return { reply: `Gemini ตอบกลับผิดพลาด (${response.status}) กรุณาตรวจสอบ model หรือ API key`, toolTrace: trace };
    const data: any = await response.json();
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const calls = parts.filter((p: any) => p.functionCall);
    if (!calls.length) return { reply: parts.filter((p: any) => typeof p.text === 'string').map((p: any) => p.text).join('') || 'Gemini ไม่ได้ส่งข้อความตอบกลับ', toolTrace: trace };
    contents.push({ role: 'model', parts });
    const results = [];
    for (const part of calls) {
      const [serverId, toolName] = String(part.functionCall.name).split('__');
      const result = await params.callTool(serverId, toolName, part.functionCall.args ?? {});
      trace.push({ serverId, toolName, arguments: part.functionCall.args ?? {}, result });
      results.push({ functionResponse: { name: part.functionCall.name, response: { result } } });
    }
    contents.push({ role: 'user', parts: results });
  }
  return { reply: 'การเรียกเครื่องมือเกินจำนวนรอบที่กำหนด', toolTrace: trace };
}