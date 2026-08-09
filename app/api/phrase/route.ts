import { createClient } from '@supabase/supabase-js';
import { RingLexiconLayer } from '@/brain-engine/layers/RingLexiconLayer.js';

const layer = new RingLexiconLayer();

function normalizeAction(action: string): string {
  if (action === 'get-word-data') return 'getWordData';
  if (action === 'save-word') return 'saveWord';
  if (action === 'report-conflict') return 'reportConflict';
  if (action === 'resolve-conflict') return 'resolveConflict';
  if (action === 'get-random-word') return 'getRandomWord';
  if (action === 'save-audio') return 'saveAudio';
  if (action === 'get-audio') return 'getAudio';
  if (action === 'get-user-vocabulary') return 'getUserVocabulary';
  if (action === 'update-vocabulary') return 'updateVocabulary';
  if (action === 'delete-vocabulary') return 'deleteVocabulary';
  return action;
}

export async function POST(req: Request) {
  const traceId = crypto.randomUUID();
  const responseHeaders = { 'Content-Type': 'application/json; charset=utf-8' };

  try {
    const rawBody = await req.text();
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_JSON', message: 'Invalid JSON', raw: rawBody.slice(0, 200) }, traceId }),
        { status: 400, headers: responseHeaders }
      );
    }

    const rawAction = payload.action || payload.type;
    if (!rawAction) {
      return new Response(
        JSON.stringify({ error: { code: 'MISSING_ACTION', message: 'Request must have "action" field', received: payload }, traceId }),
        { status: 400, headers: responseHeaders }
      );
    }

    const action = normalizeAction(rawAction);
    payload.action = action;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error(
        `[phrase] MISSING_ENV url=${supabaseUrl ? 'OK' : 'MISSING'} anonKey=${supabaseAnonKey ? 'OK' : 'MISSING'}`
      );
      return new Response(
        JSON.stringify({ error: { code: 'MISSING_ENV', message: 'Missing Supabase env vars' }, traceId }),
        { status: 500, headers: responseHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const ctx = { traceId, payload, supabase, _error: null, result: null };
    const result = await layer.handle(ctx);

    if (result._error) {
      console.error('[phrase] action error:', action, JSON.stringify(result._error));
      const status = result._error.code === 'NOT_FOUND' ? 404 : 500;
      return new Response(
        JSON.stringify({ error: result._error, traceId, debug: { action, word: payload.word } }),
        { status, headers: responseHeaders }
      );
    }

    console.log(`[phrase] ${action} ok riskScore=${result.result?.riskScore} emotion=${result.result?.emotion} meaning=${result.result?.meaning?.slice(0,20)}`);
    return new Response(
      JSON.stringify({ success: true, payload: result.result, traceId }),
      { status: 200, headers: responseHeaders }
    );
  } catch (err: any) {
    console.error('[corenull] unhandled', err);
    return new Response(
      JSON.stringify({ error: { code: 'UNHANDLED', message: err.message || 'Internal server error' }, traceId }),
      { status: 500, headers: responseHeaders }
    );
  }
}