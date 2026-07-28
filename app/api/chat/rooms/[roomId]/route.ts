export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const traceId = crypto.randomUUID();
  const { roomId } = await params;
  try {
    const { ChatRoomEngine } = await import('@/brain-engine/engines/chat/room.js');
    const result = await ChatRoomEngine({
      type: 'CLEAR_MESSAGES',
      payload: { roomId },
      traceId,
      _error: null,
    });
    if (result._error) {
      return Response.json({ payload: null, _error: result._error, traceId }, { status: 500 });
    }
    return Response.json({ payload: { cleared: true }, _error: null, traceId });
  } catch (err: any) {
    return Response.json({ payload: null, _error: err.message, traceId }, { status: 500 });
  }
}
import type { NextRequest } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const traceId = crypto.randomUUID();
  const { roomId } = await params;

  try {
    const { ChatRoomEngine } = await import('@/brain-engine/engines/chat/room.js');
    const result: any = await ChatRoomEngine({
      type:    'GET_ROOM',
      payload: { roomId },
      traceId,
      _error:  null,
    });

    if (result._error) {
      return Response.json(
        { payload: null, _error: result._error, traceId },
        { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    return Response.json(
      { payload: { room: result.room }, _error: null, traceId },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (err: any) {
    return Response.json(
      { payload: null, _error: err.message, traceId },
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const traceId = crypto.randomUUID();
  const { roomId } = await params;
  const deviceId = request.headers.get('x-device-id') || '';   // ① 헤더에서 deviceId 추출

  try {
    const { ChatRoomEngine } = await import('@/brain-engine/engines/chat/room.js');
    const result: any = await ChatRoomEngine({
      type:    'DELETE_ROOM',
      payload: { roomId, deviceId },   // ② payload에 deviceId 포함
      traceId,
      _error:  null,
    });

    if (result._error) {
      // ③ FORBIDDEN이면 403, 아니면 500
      const status = String(result._error).startsWith('FORBIDDEN') ? 403 : 500;
      return Response.json(
        { payload: null, _error: result._error, traceId },
        { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    return Response.json(
      { payload: { deleted: true }, _error: null, traceId },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (err: any) {
    return Response.json(
      { payload: null, _error: err.message, traceId },
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}