import axios from 'axios';
import type { TranscriptEntry } from '../db';

const BASE_URL = process.env.CLAWDTALK_BASE_URL || 'https://clawdtalk.com';
const API_KEY = process.env.CLAWDTALK_API_KEY || '';

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

/**
 * Create a voice assistant with custom interview instructions.
 * Returns the assistant ID.
 */
export async function createVoiceAssistant(params: {
  name: string;
  instructions: string;
  greeting: string;
}): Promise<string> {
  const response = await client.post('/v1/assistants', {
    name: params.name,
    instructions: params.instructions,
    greeting: params.greeting,
  });
  return response.data.id;
}

/**
 * Initiate an outbound call via POST /v1/calls.
 * Optionally links to an assistant for custom voice instructions.
 * Returns the ClawdTalk call_id (structured response, no text parsing).
 */
export async function initiateOutboundCall(params: {
  to: string;
  greeting?: string;
  purpose?: string;
  assistantId?: string;
}): Promise<string> {
  const body: Record<string, unknown> = { to: params.to };
  if (params.greeting) body.greeting = params.greeting;
  if (params.purpose) body.purpose = params.purpose;
  if (params.assistantId) body.assistant_id = params.assistantId;

  const response = await client.post('/v1/calls', body);
  // CallTool SDK confirms response field is `call_id`
  return response.data.call_id;
}

/**
 * Delete a voice assistant (cleanup after call completes).
 */
export async function deleteAssistant(assistantId: string): Promise<void> {
  await client.delete(`/v1/assistants/${assistantId}`);
}

/**
 * Poll GET /v1/calls/:callId until the call is completed or failed.
 */
export async function waitForCallToEnd(callId: string): Promise<void> {
  const POLL_INTERVAL_MS = 5000;
  const MAX_WAIT_MS = 20 * 60 * 1000; // 20 minutes
  const start = Date.now();

  while (Date.now() - start < MAX_WAIT_MS) {
    const response = await client.get(`/v1/calls/${callId}`);
    const callData = response.data.call ?? response.data;
    const status: string = callData.status ?? '';

    // TODO: confirm exact status strings from ClawdTalk
    if (['completed', 'ended', 'failed', 'no_answer'].includes(status)) {
      return;
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(`Call ${callId} did not complete within timeout`);
}

interface RawMessage {
  role: 'assistant' | 'user' | 'system' | 'tool';
  text: string;
  name: string | null;
  created_at: string;
  sent_at: string;
}

/**
 * Fetch assistant-data for a completed call and return structured transcript.
 * Endpoint: GET /v1/calls/:callId/assistant-data
 */
export async function getCallTranscript(callId: string): Promise<{
  transcript: TranscriptEntry[];
  summary: string;
}> {
  const response = await client.get(`/v1/calls/${callId}/assistant-data`);
  const messages: RawMessage[] = response.data.messages ?? [];
  const insights: { result: string }[] = response.data.insights?.conversation_insights ?? [];

  // Messages come newest-first — reverse to get chronological order
  const chronological = [...messages].reverse();

  // Keep only assistant and user messages with actual text
  const transcript: TranscriptEntry[] = chronological
    .filter(m => (m.role === 'assistant' || m.role === 'user') && m.text.trim() !== '')
    .map((m, i) => ({
      role: m.role === 'assistant' ? 'ai' : 'candidate',
      text: m.text.trim(),
      timestamp: m.sent_at ?? m.created_at,
      sequence: i,
    }));

  const summary = insights[0]?.result ?? '';

  return { transcript, summary };
}
