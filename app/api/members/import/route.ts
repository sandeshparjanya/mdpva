import { NextResponse } from 'next/server'
import { createClient as createSb } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Required fields aligned with Member schema
const REQUIRED_FIELDS = [
  'first_name',
  'last_name',
  'email',
  'phone',
  'profession',
  'address_line1',
  'pincode',
  'city',
  'state',
  'status',
]

// Basic CSV parser that supports quoted fields and commas within quotes
function parseCSV(content: string): string[][] {
  const rows: string[][] = []
  let current: string[] = []
  let field = ''
  let inQuotes = false

  const pushField = () => {
    current.push(field)
    field = ''
  }
  const pushRow = () => {
    // Trim potential trailing carriage return
    rows.push(current)
    current = []
  }

  for (let i = 0; i < content.length; i++) {
    const c = content[i]
    if (inQuotes) {
      if (c === '"') {
        const next = content[i + 1]
        if (next === '"') {
          field += '"' // escaped quote
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else {
      if (c === '"') {
        inQuotes = true
      } else if (c === ',') {
        pushField()
      } else if (c === '\n') {
        pushField()
        pushRow()
      } else if (c === '\r') {
        // ignore, handle on \n
      } else {
        field += c
      }
    }
  }
  // Push last field/row if any
  pushField()
  if (current.length > 1 || (current.length === 1 && current[0] !== '')) {
    pushRow()
  }
  // Remove trailing empty row if present
  while (rows.length && rows[rows.length - 1].every((v) => v === '')) rows.pop()
  return rows
}

function normalizeHeader(h: string) {
  return h.trim().toLowerCase()
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const dryRun = searchParams.get('dryRun') === 'true'
  const phase = searchParams.get('phase') || 'headers' // 'headers' or 'rows'

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const text = new TextDecoder('utf-8').decode(bytes)

    // Parse CSV
    const table = parseCSV(text)
    if (!table.length) {
      return NextResponse.json({ error: 'CSV is empty' }, { status: 400 })
    }

    const headerRow = table[0]
    const dataRows = table.slice(1)

    // Build header map
    const headers = headerRow.map((h) => h.trim())
    const headerSet = new Set(headers.map(normalizeHeader))

    const missingRequired = REQUIRED_FIELDS.filter((r) => !headerSet.has(r))

    // Preview first 5 rows
    const previewRaw = dataRows.slice(0, 5)
    const preview = previewRaw.map((r) => {
      const obj: Record<string, string> = {}
      headers.forEach((h, idx) => {
        obj[h] = (r[idx] ?? '').trim()
      })
      return obj
    })

    const base = {
      headers,
      totalRows: dataRows.length,
      preview,
      required: REQUIRED_FIELDS,
      missingRequired,
      suggestions: {},
      fileName: file.name,
      fileSize: file.size,
    }

    // For now, dryRun and apply return same analysis placeholder
    if (dryRun && phase === 'headers') {
      return NextResponse.json(base)
    }

    if (dryRun && phase === 'rows') {
      // Expect mapping
      const mappingJson = form.get('mapping') as string | null
      const duplicatePolicy = (form.get('duplicatePolicy') as string | null) || 'skip'
      let mapping: Record<string, string> = {}
      try {
        mapping = mappingJson ? JSON.parse(mappingJson) : {}
      } catch {
        return NextResponse.json({ error: 'Invalid mapping' }, { status: 400 })
      }

      // Build mapped records
      const normalizedHeaders = headers.map((h) => h.trim())
      const idxMap: Record<string, number> = {}
      normalizedHeaders.forEach((h, i) => (idxMap[h] = i))

      type RecordRow = Record<string, string>
      const rows: RecordRow[] = dataRows.map((cols) => {
        const obj: RecordRow = {}
        for (const h of normalizedHeaders) {
          const target = mapping[h] || 'ignore'
          if (target && target !== 'ignore') {
            obj[target] = (cols[idxMap[h]] ?? '').trim()
          }
        }
        return obj
      })

      const emailSet = new Set<string>()
      const phoneSet = new Set<string>()
      const dupWithinFileEmails = new Set<string>()
      const dupWithinFilePhones = new Set<string>()

      const issuesPerRow: { row: number; issues: string[] }[] = []
      const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
      const PHONE_RE = /^[+\d][\d\s()-]{6,}$/
      const PROF = new Set(['photographer', 'videographer', 'both'])
      const STATUS = new Set(['active', 'inactive', 'suspended'])
      const PIN_RE = /^\d{6}$/
      const DOB_RE = /^(0?[1-9]|[12][0-9]|3[01])\/(0?[1-9]|1[0-2])\/(19|20)\d{2}$/

      rows.forEach((r, idx) => {
        const issues: string[] = []
        // Required
        for (const f of REQUIRED_FIELDS) {
          if (!r[f] || !String(r[f]).trim()) {
            issues.push(`Missing required: ${f}`)
          }
        }
        // Email
        if (r.email) {
          r.email = r.email.toLowerCase()
          if (!EMAIL_RE.test(r.email)) issues.push('Invalid email')
          if (emailSet.has(r.email)) dupWithinFileEmails.add(r.email)
          emailSet.add(r.email)
        }
        // Phone
        if (r.phone) {
          const normalized = r.phone.replace(/[\s()-]/g, '')
          r.phone = normalized
          if (!PHONE_RE.test(r.phone)) issues.push('Invalid phone')
          if (phoneSet.has(r.phone)) dupWithinFilePhones.add(r.phone)
          phoneSet.add(r.phone)
        }
        // Enums
        if (r.profession && !PROF.has(r.profession.toLowerCase())) issues.push('Invalid profession')
        if (r.status && !STATUS.has(r.status.toLowerCase())) issues.push('Invalid status')
        // Pincode
        if (r.pincode && !PIN_RE.test(r.pincode)) issues.push('Invalid pincode')
        // DOB dd/mm/yyyy and not future
        if (r.dob) {
          if (!DOB_RE.test(r.dob)) {
            issues.push('Invalid DOB format (dd/mm/yyyy)')
          } else {
            const [dd, mm, yyyy] = r.dob.split('/')
            const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
            const now = new Date()
            if (d.getTime() > now.getTime()) issues.push('DOB cannot be in the future')
          }
        }
        if (issues.length) issuesPerRow.push({ row: idx + 2, issues }) // +2 for header + 1-index
      })

      // Cross-file duplicates counted
      const duplicateWithinFile = dupWithinFileEmails.size + dupWithinFilePhones.size

      // Existing DB duplicates by email/phone
      const supabase = createSb(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        // Use service role if available on server for reliable lookups
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const emailList = Array.from(emailSet)
      const phoneList = Array.from(phoneSet)

      const queryInBatches = async (column: 'email' | 'phone', list: string[]) => {
        const batchSize = 500
        let total = 0
        for (let i = 0; i < list.length; i += batchSize) {
          const slice = list.slice(i, i + batchSize)
          if (!slice.length) continue
          const { data, error } = await supabase
            .from('members')
            .select('id, deleted_at')
            .in(column, slice)
            .limit(1000)
          if (error) continue
          total += data?.length || 0
        }
        return total
      }

      const [dupEmailsDB, dupPhonesDB] = await Promise.all([
        queryInBatches('email', emailList),
        queryInBatches('phone', phoneList),
      ])

      const duplicateExisting = dupEmailsDB + dupPhonesDB

      const valid = dataRows.length - issuesPerRow.length

      return NextResponse.json({
        ...base,
        duplicatePolicy,
        summary: { total: dataRows.length, valid, invalid: issuesPerRow.length, duplicateWithinFile, duplicateExisting },
        errors: issuesPerRow,
      })
    }

    // APPLY path
    // Expect mapping and duplicatePolicy; process rows in chunks
    const mappingJson = form.get('mapping') as string | null
    const duplicatePolicy = ((form.get('duplicatePolicy') as string | null) || 'skip') as 'skip' | 'update' | 'undelete'
    let mapping: Record<string, string> = {}
    try {
      mapping = mappingJson ? JSON.parse(mappingJson) : {}
    } catch {
      return NextResponse.json({ error: 'Invalid mapping' }, { status: 400 })
    }

    const normalizedHeaders = headers.map((h) => h.trim())
    const idxMap: Record<string, number> = {}
    normalizedHeaders.forEach((h, i) => (idxMap[h] = i))

    type RecordRow = Record<string, string>
    const rows: RecordRow[] = dataRows.map((cols) => {
      const obj: RecordRow = {}
      for (const h of normalizedHeaders) {
        const target = mapping[h] || 'ignore'
        if (target && target !== 'ignore') {
          obj[target] = (cols[idxMap[h]] ?? '').trim()
        }
      }
      return obj
    })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY or URL missing' }, { status: 500 })
    }
    const supabase = createSb(supabaseUrl, serviceKey)

    const toISODate = (ddmmyyyy?: string) => {
      if (!ddmmyyyy) return null
      const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(ddmmyyyy)
      if (!m) return null
      const dd = Number(m[1]).toString().padStart(2, '0')
      const mm = Number(m[2]).toString().padStart(2, '0')
      const yyyy = m[3]
      return `${yyyy}-${mm}-${dd}`
    }

    const currentYear = new Date().getFullYear()
    const yearSuffix = currentYear.toString().slice(-2)
    const generateMemberID = async (): Promise<string> => {
      const { data, error } = await supabase
        .from('members')
        .select('member_id')
        .like('member_id', `MDPVA${yearSuffix}%`)
        .order('member_id', { ascending: false })
        .limit(1)
      if (error || !data || data.length === 0) return `MDPVA${yearSuffix}00001`
      const latest = data[0].member_id as string
      const num = parseInt(latest.slice(-5)) + 1
      return `MDPVA${yearSuffix}${num.toString().padStart(5, '0')}`
    }

    const results: { row: number; status: 'created' | 'updated' | 'skipped' | 'undeleted' | 'failed'; reason?: string }[] = []
    let created = 0, updated = 0, skipped = 0, undeleted = 0, failed = 0

    const BATCH = 100
    for (let start = 0; start < rows.length; start += BATCH) {
      const slice = rows.slice(start, start + BATCH)
      for (let i = 0; i < slice.length; i++) {
        const logicalRow = start + i + 2 // header + 1-index
        const r = slice[i]

        // Basic required checks before DB ops
        let missing = REQUIRED_FIELDS.filter((f) => !r[f] || !String(r[f]).trim())
        if (missing.length) {
          results.push({ row: logicalRow, status: 'failed', reason: `Missing required: ${missing.join(', ')}` })
          failed++
          continue
        }
        const email = String(r.email).toLowerCase()
        const phone = String(r.phone).replace(/[\s()-]/g, '')

        // Find existing by email or phone
        const { data: existingRows, error: findErr } = await supabase
          .from('members')
          .select('*')
          .or(`email.eq.${email},phone.eq.${phone}`)
          .limit(1)
        if (findErr) {
          results.push({ row: logicalRow, status: 'failed', reason: `Lookup failed: ${findErr.message || findErr.code || 'unknown'}` })
          failed++
          continue
        }
        const existing = existingRows?.[0]

        // Build payload
        const payload: any = {
          first_name: r.first_name,
          last_name: r.last_name,
          email,
          phone,
          profession: r.profession?.toLowerCase(),
          business_name: r.business_name || null,
          address_line1: r.address_line1,
          address_line2: r.address_line2 || null,
          pincode: r.pincode,
          area: r.area || null,
          city: r.city,
          state: r.state,
          status: r.status?.toLowerCase(),
          blood_group: r.blood_group || null,
          notes: r.notes || null,
        }
        const isoDob = toISODate(r.dob)
        if (isoDob) payload.dob = isoDob

        if (existing) {
          const isDeleted = !!existing.deleted_at
          if (duplicatePolicy === 'skip' && !isDeleted) {
            results.push({ row: logicalRow, status: 'skipped', reason: 'Duplicate existing' })
            skipped++
            continue
          }
          if (duplicatePolicy === 'update' && !isDeleted) {
            const { error: upErr } = await supabase
              .from('members')
              .update(payload)
              .eq('id', existing.id)
            if (upErr) {
              results.push({ row: logicalRow, status: 'failed', reason: `Update failed: ${upErr.message || upErr.code || 'unknown'}` })
              failed++
            } else {
              updated++
              results.push({ row: logicalRow, status: 'updated' })
            }
            continue
          }
          if (duplicatePolicy === 'undelete') {
            const { error: undErr } = await supabase
              .from('members')
              .update({ ...payload, deleted_at: null })
              .eq('id', existing.id)
            if (undErr) {
              results.push({ row: logicalRow, status: 'failed', reason: `Undelete failed: ${undErr.message || undErr.code || 'unknown'}` })
              failed++
            } else {
              undeleted++
              results.push({ row: logicalRow, status: 'undeleted' })
            }
            continue
          }
          // For update policy when record is soft-deleted, do not undelete; skip
          results.push({ row: logicalRow, status: 'skipped', reason: 'Soft-deleted duplicate' })
          skipped++
          continue
        }

        // Insert new
        const member_id = await generateMemberID()
        const insertPayload = { member_id, ...payload }
        const { error: insErr } = await supabase.from('members').insert(insertPayload)
        if (insErr) {
          results.push({ row: logicalRow, status: 'failed', reason: `Insert failed: ${insErr.message || insErr.code || 'unknown'}` })
          failed++
        } else {
          created++
          results.push({ row: logicalRow, status: 'created' })
        }
      }
    }

    return NextResponse.json({
      ...base,
      duplicatePolicy,
      summary: { total: dataRows.length, created, updated, skipped, undeleted, failed },
      results,
    })
  } catch (e: any) {
    console.error('Import error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to process file' }, { status: 500 })
  }
}
