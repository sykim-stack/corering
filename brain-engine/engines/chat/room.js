// brain-engine/engines/chat/room.js
import { getStorage } from '../../connectors/storage.js';

function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) { code += chars.charAt(Math.floor(Math.random() * chars.length)); }
  return code;
}

async function createRoom(ctx) {
  const { title, createdBy = 'anonymous', tags = [], maxParticipants = 100, isPublic = true } = ctx.payload || {};
  if (!title) return { ...ctx, _error: 'Room title is required' };
  const supabase = await getStorage();
  if (!supabase) return { ...ctx, _error: 'DB connection failed' };
  const { data, error } = await supabase.from('chat_rooms').insert({ room_name: title, invite_code: generateInviteCode(), room_type: 'chat', created_by: null, owner_device_id: createdBy, is_permanent: false, is_public: isPublic, metadata: { tags, maxParticipants, createdBy, isPublic } }).select().single();
  if (error) return { ...ctx, _error: error.message };
  return { ...ctx, room: { roomId: data.id, inviteCode: data.invite_code, title: data.room_name, status: 'active', createdBy, createdAt: data.created_at, updatedAt: data.created_at, messageCount: 0, participantCount: 1, maxParticipants, tags } };
}

async function getRoom(ctx) {
  const { roomId } = ctx.payload || {};
  const supabase = await getStorage();
  if (!supabase) return { ...ctx, _error: 'DB connection failed' };
  const { data, error } = await supabase.from('chat_rooms').select('*').eq('id', roomId).single();
  if (error || !data) return { ...ctx, _error: 'Room not found: ' + roomId };
  return { ...ctx, room: { roomId: data.id, inviteCode: data.invite_code, title: data.room_name, status: 'active', createdBy: data.metadata?.createdBy || 'anonymous', createdAt: data.created_at, updatedAt: data.created_at, messageCount: data.metadata?.messageCount || 0, participantCount: 0, maxParticipants: data.metadata?.maxParticipants || 100, tags: data.metadata?.tags || [] } };
}

async function listRooms(ctx) {
  const supabase = await getStorage();
  if (!supabase) return { ...ctx, _error: 'DB connection failed' };
  const { data, error } = await supabase.from('chat_rooms').select('*').eq('is_public', true).order('created_at', { ascending: false });
  if (error) return { ...ctx, _error: error.message };
  return { ...ctx, rooms: (data || []).map(r => ({ roomId: r.id, inviteCode: r.invite_code, title: r.room_name, status: 'active', createdBy: r.metadata?.createdBy || 'anonymous', createdAt: r.created_at, updatedAt: r.created_at, messageCount: r.metadata?.messageCount || 0, participantCount: 0, maxParticipants: r.metadata?.maxParticipants || 100, tags: r.metadata?.tags || [] })) };
}

async function clearMessages(ctx) {
  const { roomId } = ctx.payload || {};
  if (!roomId) return { ...ctx, _error: 'roomId required' };
  const supabase = await getStorage();
  if (!supabase) return { ...ctx, _error: 'DB connection failed' };
  const { error } = await supabase.from('chat_messages').delete().eq('room_id', roomId);
  if (error) return { ...ctx, _error: error.message };
  return { ...ctx, cleared: true };
}

async function deleteRoom(ctx) {
  const { roomId, deviceId } = ctx.payload || {};
  const supabase = await getStorage();
  if (!supabase) return { ...ctx, _error: 'DB connection failed' };

  // 방장(owner_device_id)만 삭제 가능하도록 검증
  const { data: existing, error: fetchError } = await supabase
    .from('chat_rooms').select('owner_device_id').eq('id', roomId).maybeSingle();
  if (fetchError) return { ...ctx, _error: fetchError.message };
  if (!existing) return { ...ctx, _error: 'Room not found: ' + roomId };
  if (!deviceId || existing.owner_device_id !== deviceId) {
    return { ...ctx, _error: 'FORBIDDEN: 방장만 삭제할 수 있습니다.' };
  }

  const { error } = await supabase.from('chat_rooms').delete().eq('id', roomId);
  if (error) return { ...ctx, _error: error.message };
  return { ...ctx, deleted: true };
}

async function joinRoom(ctx) {
  const { roomId, userId, nickname } = ctx.payload || {};
  const supabase = await getStorage();
  if (!supabase) return { ...ctx, _error: 'DB connection failed' };
  const { error } = await supabase.from('chat_participants').insert({ room_id: roomId, user_id: null, nickname: nickname || 'anonymous', role: 'member', device_id: userId || 'anonymous' });
  if (error) return { ...ctx, _error: error.message };
  return { ...ctx, joined: true, event: { type: 'JOIN', roomId, userId } };
}

async function findByCode(ctx) {
  const { inviteCode } = ctx.payload || {};
  if (!inviteCode) return { ...ctx, _error: 'inviteCode required' };
  const supabase = await getStorage();
  if (!supabase) return { ...ctx, _error: 'DB connection failed' };
  const { data, error } = await supabase.from('chat_rooms').select('*').eq('invite_code', inviteCode).single();
  if (error || !data) return { ...ctx, _error: 'Room not found: ' + inviteCode };
  return { ...ctx, payload: { ...ctx.payload, room: { roomId: data.id, inviteCode: data.invite_code, title: data.room_name, createdAt: data.created_at } } };
}

const actionMap = {
  CREATE_ROOM: createRoom,
  GET_ROOM: getRoom,
  LIST_ROOMS: listRooms,
  DELETE_ROOM: deleteRoom,
  CLEAR_MESSAGES: clearMessages,
  JOIN_ROOM: joinRoom,
  FIND_BY_CODE: findByCode,
};

export async function ChatRoomEngine(ctx) {
  if (!ctx || ctx._error) return ctx;
  const handler = actionMap[ctx.type];
  if (!handler) return ctx;
  return await handler(ctx);
}

export default ChatRoomEngine;