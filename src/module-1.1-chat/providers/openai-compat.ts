import type { ChatMessage, ChatTurnResult, McpTool, ToolCaller, ToolTraceEntry } from '../types';
export async function runOpenAiCompatConversation(params: { baseUrl: string; apiKey: string; model: string; history: ChatMessage[]; systemPrompt: string; tools: McpTool[]; callTool: ToolCaller }): Promise<ChatTurnResult> {
  if (!params.baseUrl) return { reply: 'ยังไม่ได้ตั้งค่า base URL ของ OpenAI-compatible gateway', toolTrace: [] };
  if (!params.apiKey) return { reply: 'ยังไม่ได้ตั้งค่า API key ของ provider ที่เลือก กรุณาตั้งค่าก่อนใช้งาน', toolTrace: [] };
  const messages: any[] = [{ role: 'system', content: params.systemPrompt }, ...params.history];
  const trace: ToolTraceEntry[] = [];
  const url = `${params.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  for (let round = 0; round < 4; round++) {
    const body: any = { model: params.model, messages };
    if (params.tools.length) { body.tools = params.tools.map((t) => ({ type: 'function', function: { name: `${t.serverId}__${t.name}`, description: t.description, parameters: t.inputSchema } })); body.tool_choice = 'auto'; }
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${params.apiKey}` }, body: JSON.stringify(body) });
    if (!response.ok) return { reply: `AI provider ตอบกลับผิดพลาด (${response.status}) กรุณาตรวจสอบการตั้งค่า`, toolTrace: trace };
    const data: any = await response.json(); const message = data.choices?.[0]?.message;
    if (!message) return { reply: 'AI provider ไม่ได้ส่งข้อความตอบกลับ', toolTrace: trace };
    messages.push(message);
    if (!message.tool_calls?.length) return { reply: message.content || 'AI provider ไม่ได้ส่งข้อความตอบกลับ', toolTrace: trace };
    for (const call of message.tool_calls) { const [serverId, toolName] = String(call.function.name).split('__'); const args = JSON.parse(call.function.arguments || '{}'); const result = await params.callTool(serverId, toolName, args); trace.push({ serverId, toolName, arguments: args, result }); messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) }); }
  }
  return { reply: 'การเรียกเครื่องมือเกินจำนวนรอบที่กำหนด', toolTrace: trace };
}