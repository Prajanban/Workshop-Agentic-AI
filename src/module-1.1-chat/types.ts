export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type ChatProvider = 'gemini' | 'openai' | 'openai-compat';

export interface McpTool {
  serverId: string;
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}
export interface ToolTraceEntry { serverId: string; toolName: string; arguments: unknown; result: unknown; }
export interface ChatTurnResult { reply: string; toolTrace: ToolTraceEntry[]; }
export type ToolCaller = (serverId: string, toolName: string, args: unknown) => Promise<unknown>;
export function toolFunctionName(serverId: string, toolName: string): string { return `${serverId}__${toolName}`; }