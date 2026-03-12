// ============================================================
// CoreChat API v2
// Vercel Serverless + Supabase
// rooms.js v6.0 완전 호환
// ============================================================

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {

  const { action } = req.query

  try {

    if (action === "create-room")  return await createRoom(req, res)
    if (action === "join-room")    return await joinRoom(req, res)
    if (action === "get-rooms")    return await getRooms(req, res)
    if (action === "send-message") return await sendMessage(req, res)
    if (action === "get-messages") return await getMessages(req, res)
    if (action === "delete-room")  return await deleteRoom(req, res)

    return res.status(400).json({ error: "invalid action" })

  } catch (err) {
    console.error("corechat error:", err)
    res.status(500).json({ error: "server error" })
  }
}

// ============================================================
// create-room
// body: { device_id, room_type? }
// ============================================================
async function createRoom(req, res) {
  const { device_id, room_type = "dm" } = req.body

  if (!device_id) return res.status(400).json({ error: "device_id required" })

  const invite_code = Math.random().toString(36).slice(2, 8).toUpperCase()

  const { data: room, error } = await supabase
    .from("rooms")
    .insert({ invite_code, owner_device_id: device_id })
    .select()
    .single()

  if (error) return res.status(500).json({ error })

  // 방장 자동 등록
  await supabase
    .from("room_members")
    .insert({ room_id: room.id, device_id })

  res.json(room)
}

// ============================================================
// join-room
// body: { invite_code, nickname, device_id }
// ============================================================
async function joinRoom(req, res) {
  const { invite_code, nickname, device_id } = req.body

  if (!invite_code || !device_id) return res.status(400).json({ error: "invite_code, device_id required" })

  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .select("*")
    .eq("invite_code", invite_code.toUpperCase())
    .single()

  if (roomErr || !room) return res.status(404).json({ error: "room not found" })

  // 중복 참가 방지
  const { data: existing } = await supabase
    .from("room_members")
    .select("id")
    .eq("room_id", room.id)
    .eq("device_id", device_id)
    .single()

  if (!existing) {
    await supabase
      .from("room_members")
      .insert({ room_id: room.id, device_id, nickname })
  }

  res.json(room)
}

// ============================================================
// get-rooms
// query: { user_id? } ← device_id 없어도 전체 반환 (Phase 0)
// ============================================================
async function getRooms(req, res) {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) return res.status(500).json({ error })

  res.json(data)
}

// ============================================================
// send-message
// body: { room_id, device_id, nickname, message, translated_ko?, translated_vi? }
// ============================================================
async function sendMessage(req, res) {
  const {
    room_id,
    device_id,
    nickname,
    message,
    translated_ko,
    translated_vi
  } = req.body

  if (!room_id || !message) return res.status(400).json({ error: "room_id, message required" })

  const { data, error } = await supabase
    .from("messages")
    .insert({
      room_id,
      device_id,
      nickname,
      message,
      translated_ko: translated_ko || null,
      translated_vi: translated_vi || null
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error })

  res.json({ success: true, message: data })
}

// ============================================================
// get-messages
// query: { room_id, after? }  ← after: ISO timestamp (폴링용)
// ============================================================
async function getMessages(req, res) {
  const { room_id, after } = req.query

  if (!room_id) return res.status(400).json({ error: "room_id required" })

  let query = supabase
    .from("messages")
    .select("*")
    .eq("room_id", room_id)
    .order("created_at", { ascending: true })

    if (after) query = query.gt("created_at", after)

  const { data, error } = await query

  if (error) return res.status(500).json({ error })

  res.json(data)
}

// ============================================================
// delete-room
// body: { room_id, device_id }  ← 방장만 삭제 가능
// ============================================================
async function deleteRoom(req, res) {
  const { room_id, device_id } = req.body

  if (!room_id || !device_id) return res.status(400).json({ error: "room_id, device_id required" })

  // 방장 확인
  const { data: room } = await supabase
    .from("rooms")
    .select("owner_id")
    .eq("id", room_id)
    .single()

  if (!room) return res.status(404).json({ error: "room not found" })
  if (room.owner_id !== device_id) return res.status(403).json({ error: "not owner" })

  await supabase.from("rooms").delete().eq("id", room_id)

  res.json({ ok: true })
}