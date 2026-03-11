import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { user_id, target_user_id, room_type = "dm" } = req.body

  const { data: room, error } = await supabase
    .from('chat_rooms')
    .insert({
      room_type,
      created_by: user_id
    })
    .select()
    .single()

  if (error) {
    return res.status(500).json(error)
  }

  await supabase.from('chat_participants').insert([
    { room_id: room.id, user_id },
    { room_id: room.id, user_id: target_user_id }
  ])

  res.json(room)
}