import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAjustes() {
  const { data, error } = await supabase.from('ajustes_sistema').select('*')
  if (error) {
    console.error('Error fetching ajustes:', error)
  } else {
    console.log('Ajustes de sistema:', data)
  }
}

checkAjustes()
