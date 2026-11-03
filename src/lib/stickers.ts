import { supabase } from './supabase'

export type Sticker = {
  id: string
  place: string
  name: string
  memo: string
  mood: string
  traits: string[]
  imageUrl: string
  createdAt: string
  bookLabel: number | null
  bookPage: number | null
  bookSlot: number | null
  decoX: number | null
  decoY: number | null
}

type Row = {
  id: string
  place: string
  name: string
  memo: string
  // 003 마이그레이션 전 DB 에는 없다
  mood?: string
  traits?: string[]
  image_path: string
  created_at: string
  book_label: number | null
  book_page: number | null
  book_slot: number | null
  deco_x: number | null
  deco_y: number | null
}

const BUCKET = 'stickers'

// Supabase 키가 없을 때 쓰는 메모리 저장소
let memory: Sticker[] = []

function fromRow(row: Row): Sticker {
  const { data } = supabase!.storage.from(BUCKET).getPublicUrl(row.image_path)
  return {
    id: row.id,
    place: row.place,
    name: row.name,
    memo: row.memo,
    mood: row.mood ?? '',
    traits: row.traits ?? [],
    imageUrl: data.publicUrl,
    createdAt: row.created_at,
    bookLabel: row.book_label ?? null,
    bookPage: row.book_page,
    bookSlot: row.book_slot,
    decoX: row.deco_x,
    decoY: row.deco_y,
  }
}

export async function listStickers(): Promise<Sticker[]> {
  if (!supabase) return memory
  const { data, error } = await supabase
    .from('stickers')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as Row[]).map(fromRow)
}

export type NewSticker = { place: string; name: string; memo: string; mood: string; traits: string[]; image: Blob }

export async function createSticker(input: NewSticker): Promise<Sticker> {
  if (!supabase) {
    const sticker: Sticker = {
      id: crypto.randomUUID(),
      place: input.place,
      name: input.name,
      memo: input.memo,
      mood: input.mood,
      traits: input.traits,
      imageUrl: URL.createObjectURL(input.image),
      createdAt: new Date().toISOString(),
      bookLabel: null,
      bookPage: null,
      bookSlot: null,
      decoX: null,
      decoY: null,
    }
    memory = [...memory, sticker]
    return sticker
  }

  const path = `${crypto.randomUUID()}.png`
  const upload = await supabase.storage
    .from(BUCKET)
    .upload(path, input.image, { contentType: 'image/png' })
  if (upload.error) throw upload.error

  const base = { place: input.place, name: input.name, memo: input.memo, image_path: path }
  const insert = (row: Partial<Row>) => supabase!.from('stickers').insert(row).select().single()
  let { data, error } = await insert({ ...base, mood: input.mood, traits: input.traits })
  // 팀 DB 에 003 마이그레이션이 아직 안 돌았으면 분위기·성격 없이 저장한다 (PGRST204: 없는 컬럼)
  if (error?.code === 'PGRST204') {
    console.warn('stickers 테이블에 mood/traits 컬럼이 없어 빼고 저장합니다. supabase/migrations/003 을 실행하세요.')
    ;({ data, error } = await insert(base))
  }
  if (error) throw error
  return fromRow(data as Row)
}

export type StickerPatch = Partial<Pick<Sticker, 'bookLabel' | 'bookPage' | 'bookSlot' | 'decoX' | 'decoY'>>

export async function updateSticker(id: string, patch: StickerPatch): Promise<void> {
  if (!supabase) {
    memory = memory.map((s) => (s.id === id ? { ...s, ...patch } : s))
    return
  }
  const row: Partial<Row> = {}
  if ('bookLabel' in patch) row.book_label = patch.bookLabel
  if ('bookPage' in patch) row.book_page = patch.bookPage
  if ('bookSlot' in patch) row.book_slot = patch.bookSlot
  if ('decoX' in patch) row.deco_x = patch.decoX
  if ('decoY' in patch) row.deco_y = patch.decoY
  const { error } = await supabase.from('stickers').update(row).eq('id', id)
  if (error) throw error
}
