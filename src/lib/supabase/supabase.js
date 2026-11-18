import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nugugnupsgtghdsludxz.supabase.co/rest/v1/'
const supabaseKey = 'sb_publishable_24A8nb16y0Y7EH0pdYde9w_l-SHxJ1-'

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)
