import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
)

export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).end()
  }

  const { invite_code } = req.body

  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('invite_code', invite_code)
    .single()

  if (error) {
    return res.status(404).json({ error: 'room not found' })
  }

  res.json(data)
}