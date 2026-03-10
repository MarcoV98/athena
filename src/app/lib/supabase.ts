import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://qqfocioqmgroqgfqkyto.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxZm9jaW9xbWdyb3FnZnFreXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxODE0NzYsImV4cCI6MjA4ODc1NzQ3Nn0.-g_nz9H1rl5eG55fWw8iv1hBZ8t-nH8vs0DTPFqY8jU"

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// TIPI 

export type OvertimeMap = Record<string, { start: string; end: string }>
export type FerieSet = Set<string>

// LOAD

export async function loadDati(utente: string): Promise<{
  overtimeMap: OvertimeMap
  ferieSet: FerieSet
}> {
  const [{ data: straordinari, error: e1 }, { data: ferie, error: e2 }] =
    await Promise.all([
      supabase.from('straordinari').select('*').eq('utente', utente),
      supabase.from('ferie').select('*').eq('utente', utente),
    ])

  if (e1) console.error('Errore caricamento straordinari:', e1)
  if (e2) console.error('Errore caricamento ferie:', e2)

  const overtimeMap: OvertimeMap = {}
  for (const r of straordinari ?? []) {
    overtimeMap[r.data] = {
      start: r.ora_inizio.slice(0, 5),
      end: r.ora_fine.slice(0, 5),
    }
  }

  const ferieSet: FerieSet = new Set((ferie ?? []).map((r: any) => r.data))

  return { overtimeMap, ferieSet }
}

// STRAORDINARI 

export async function salvaStaordinario(
  utente: string,
  data: string,
  ora_inizio: string,
  ora_fine: string
): Promise<void> {
  const { error } = await supabase
    .from('straordinari')
    .upsert({ utente, data, ora_inizio, ora_fine }, { onConflict: 'utente,data' })

  if (error) console.error('Errore salvataggio straordinario:', error)
}

export async function rimuoviStaordinario(
  utente: string,
  data: string
): Promise<void> {
  const { error } = await supabase
    .from('straordinari')
    .delete()
    .eq('utente', utente)
    .eq('data', data)

  if (error) console.error('Errore rimozione straordinario:', error)
}

// FERIE 

export async function aggiungiFeria(
  utente: string,
  data: string
): Promise<void> {
  const { error } = await supabase
    .from('ferie')
    .upsert({ utente, data }, { onConflict: 'utente,data' })

  if (error) console.error('Errore aggiunta feria:', error)
}

export async function rimuoviFeria(
  utente: string,
  data: string
): Promise<void> {
  const { error } = await supabase
    .from('ferie')
    .delete()
    .eq('utente', utente)
    .eq('data', data)

  if (error) console.error('Errore rimozione feria:', error)
}