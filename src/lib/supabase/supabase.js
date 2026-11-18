import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'COLOQUE_SUA_PROJECT_URL'
const supabaseKey = 'COLOQUE_SUA_PUBLISHABLE_KEY'

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)
