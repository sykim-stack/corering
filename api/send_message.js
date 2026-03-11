import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { room_id, sender_id, message } = req.body

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      room_id,
      sender_id,
      message
    })
    .select()

  if (error) {
    return res.status(500).json(error)
  }

  res.json(data)
}