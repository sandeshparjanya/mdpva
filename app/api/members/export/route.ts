import { NextRequest, NextResponse } from 'next/server'
import { createServerClientSupabase } from '@/lib/supabaseServer'
import React from 'react'
// IMPORTANT: Do not statically import '@react-pdf/renderer'.
// Next dev may attempt to bundle it even for CSV requests and fail due to bidi-js interop.
// We'll dynamically import it only when format=pdf.
import { formatInTimeZone } from 'date-fns-tz'

export const runtime = 'nodejs'

// Simple in-memory rate limit per IP: N requests per windowMs
const RATE_LIMIT_PER_MINUTE = 3
const WINDOW_MS = 60_000
const rateMap: Map<string, { count: number; windowStart: number }> = new Map()

function rateLimitOk(ip: string): boolean {
  const now = Date.now()
  const rec = rateMap.get(ip)
  if (!rec) {
    rateMap.set(ip, { count: 1, windowStart: now })
    return true
  }
  if (now - rec.windowStart > WINDOW_MS) {
    rateMap.set(ip, { count: 1, windowStart: now })
    return true
  }
  if (rec.count < RATE_LIMIT_PER_MINUTE) {
    rec.count += 1
    return true
  }
  return false
}

function csvEscape(value: any): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  // Prevent CSV injection (Excel) by prefixing leading special chars
  if (/^[=+\-@]/.test(s)) s = "'" + s
  // Escape quotes by doubling
  s = s.replace(/"/g, '""')
  return `"${s}"`
}

function formatTimestampISO(v: any): string {
  if (!v) return ''
  try {
    const d = new Date(v)
    return d.toISOString()
  } catch {
    return ''
  }
}

type Scope = 'current' | 'all'
type SortKey = 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc' | 'updated_desc' | 'id_desc' | 'id_asc'

type ColumnsMode = 'default' | 'all'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const supabase = createServerClientSupabase()

  // Rate limit per IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.ip || 'unknown'
  if (!rateLimitOk(ip)) {
    return new NextResponse('Rate limit exceeded. Please try again in a minute.', { status: 429 })
  }

  // Parse query params
  const scope = (url.searchParams.get('scope') as Scope) || 'current'
  const format = (url.searchParams.get('format') || 'csv').toLowerCase()
  const q = (url.searchParams.get('q') || '').trim()
  const filter = url.searchParams.get('filter') || 'all' // all|active|inactive|newThisMonth
  const sortBy = (url.searchParams.get('sort') as SortKey) || 'created_desc'
  const columnsMode = (url.searchParams.get('columns') as ColumnsMode) || 'default'

  if (format !== 'csv' && format !== 'pdf') {
    return new NextResponse('Unsupported format.', { status: 400 })
  }

  // Build count query first (to embed count in filename)
  try {
    let countReq = supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)

    if (scope === 'current') {
      // Apply search
      if (q) {
        const upper = q.toUpperCase()
        if (/^MDPVA/i.test(q)) {
          countReq = countReq.ilike('member_id', `${upper}%`)
        } else {
          countReq = countReq.or(
            `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,member_id.ilike.%${q}%`
          )
        }
      }
      // Apply filter
      if (filter === 'active') countReq = countReq.eq('status', 'active')
      if (filter === 'inactive') countReq = countReq.eq('status', 'inactive')
      if (filter === 'newThisMonth') {
        const now = new Date()
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        countReq = countReq.gte('created_at', firstOfMonth)
      }
      // Sorting not needed for count
    }

    const countRes = await countReq
    const total = countRes.count || 0

    // Columns (CSV default set; also reuse for PDF base fields)
    const defaultColumns = [
      'member_id', 'first_name', 'last_name', 'status', 'email', 'phone', 'profession', 'business_name',
      'address_line1', 'address_line2', 'area', 'city', 'state', 'pincode', 'created_at', 'updated_at'
    ] as const
    const allExtra = ['profile_photo_url', 'notes'] as const
    const columns = columnsMode === 'all' ? [...defaultColumns, ...allExtra] : [...defaultColumns]

    // If PDF requested, generate PDF response path
    if (format === 'pdf') {
      // Dynamic import to avoid bundling issues when only CSV is used
      const { Document, Page, Text, View, Image, StyleSheet, pdf } = await import('@react-pdf/renderer')
      // Fetch total active members (for header)
      const activeCountRes = await supabase
        .from('members')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null)
        .eq('status', 'active')
      const activeCount = activeCountRes.count || 0

      // Collect members in memory (acceptable for ~1.5k)
      type Row = {
        member_id: string
        first_name: string | null
        last_name: string | null
        phone: string | null
        profession: string | null
        city: string | null
        state: string | null
        status: string | null
        created_at: string | null
        profile_photo_url?: string | null
      }

      const selectCols = [
        'member_id', 'first_name', 'last_name', 'phone', 'profession', 'city', 'state', 'status', 'created_at', 'profile_photo_url'
      ]

      const pageSize = 1000
      let from = 0
      const allRows: Row[] = []
      let more = true

      while (more) {
        let dataReq = supabase
          .from('members')
          .select(selectCols.join(','))
          .is('deleted_at', null)
          .range(from, from + pageSize - 1)

        if (scope === 'current') {
          // Search
          if (q) {
            const upper = q.toUpperCase()
            if (/^MDPVA/i.test(q)) {
              dataReq = dataReq.ilike('member_id', `${upper}%`)
            } else {
              dataReq = dataReq.or(
                `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,member_id.ilike.%${q}%`
              )
            }
          }
          // Filter
          if (filter === 'active') dataReq = dataReq.eq('status', 'active')
          if (filter === 'inactive') dataReq = dataReq.eq('status', 'inactive')
          if (filter === 'newThisMonth') {
            const n2 = new Date()
            const firstOfMonth2 = new Date(n2.getFullYear(), n2.getMonth(), 1).toISOString()
            dataReq = dataReq.gte('created_at', firstOfMonth2)
          }
          // Sort
          switch (sortBy) {
            case 'created_asc':
              dataReq = dataReq.order('created_at', { ascending: true }).order('member_id', { ascending: true })
              break
            case 'name_asc':
              dataReq = dataReq.order('last_name', { ascending: true, nullsFirst: true }).order('first_name', { ascending: true, nullsFirst: true })
              break
            case 'name_desc':
              dataReq = dataReq.order('last_name', { ascending: false, nullsFirst: false }).order('first_name', { ascending: false, nullsFirst: false })
              break
            case 'updated_desc':
              dataReq = dataReq.order('updated_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
              break
            case 'id_asc':
              dataReq = dataReq.order('member_id', { ascending: true })
              break
            case 'id_desc':
              dataReq = dataReq.order('member_id', { ascending: false })
              break
            case 'created_desc':
            default:
              dataReq = dataReq.order('created_at', { ascending: false }).order('member_id', { ascending: false })
              break
          }
        } else {
          // scope === 'all'
          dataReq = dataReq.order('created_at', { ascending: false }).order('member_id', { ascending: false })
        }

        const { data, error } = await dataReq
        if (error) throw error
        const rows = (data as Row[]) || []
        allRows.push(...rows)
        from += pageSize
        if (rows.length < pageSize) {
          more = false
        }
      }

      // Thumbnail helper (Supabase public URL -> transform URL)
      const toThumb = (url?: string | null) => {
        if (!url) return null
        try {
          const u = new URL(url)
          // Replace /object/public/ with /render/image/public/
          u.pathname = u.pathname.replace('/object/public/', '/render/image/public/')
          u.searchParams.set('width', '96')
          u.searchParams.set('quality', '70')
          return u.toString()
        } catch {
          return url
        }
      }

      // Styles
      const styles = StyleSheet.create({
        page: {
          paddingTop: 40, paddingBottom: 40, paddingHorizontal: 32, flexDirection: 'column'
        },
        header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
        headerLeft: { flexDirection: 'row', alignItems: 'center' },
        logoBox: { width: 50, height: 50, backgroundColor: '#e5e7eb', borderRadius: 4, marginRight: 12 },
        headerTitleWrap: { flexDirection: 'column' },
        title: { fontSize: 12, fontWeight: 700 },
        website: { fontSize: 9, color: '#374151' },
        headerRight: { fontSize: 8, color: '#4b5563' },
        grid: { flexDirection: 'row', flexWrap: 'wrap' },
        card: { width: '25%', padding: 8, flexDirection: 'row' },
        photo: { width: 64, height: 64, backgroundColor: '#f3f4f6', borderRadius: 4 },
        meta: { marginLeft: 8, flexGrow: 1 },
        name: { fontSize: 9, fontWeight: 700 },
        line: { fontSize: 8, color: '#111827' },
        footer: { position: 'absolute', bottom: 16, left: 32, right: 32, fontSize: 8, color: '#4b5563', flexDirection: 'row', justifyContent: 'space-between' },
      })

      // Fonts (optional: system fonts usually OK in many viewers)
      // If needed, register a font here via Font.register

      const nowIST = formatInTimeZone(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm zzz')

      const cards = allRows.map((m, idx) => (
        React.createElement(
          View,
          { key: m.member_id + '-' + idx, style: styles.card },
          m.profile_photo_url
            ? React.createElement(Image, { src: toThumb(m.profile_photo_url) || '', style: styles.photo })
            : React.createElement(View, { style: styles.photo }),
          React.createElement(
            View,
            { style: styles.meta },
            React.createElement(
              Text,
              { style: styles.name },
              `${m.member_id} · ${(m.first_name || '') + (m.last_name ? ' ' + m.last_name : '')}`
            ),
            React.createElement(Text, { style: styles.line }, `Phone: ${m.phone || ''}`),
            React.createElement(
              Text,
              { style: styles.line },
              `City/State: ${(m.city || '') + (m.state ? ', ' + m.state : '')}`
            ),
            React.createElement(Text, { style: styles.line }, `Profession: ${m.profession || ''}`)
          )
        )
      ))

      const PdfDoc = React.createElement(
        Document,
        null,
        React.createElement(
          Page,
          { size: 'A4', orientation: 'landscape', style: styles.page },
          // Header
          React.createElement(
            View,
            { style: styles.header, fixed: true },
            React.createElement(
              View,
              { style: styles.headerLeft },
              React.createElement(View, { style: styles.logoBox }),
              React.createElement(
                View,
                { style: styles.headerTitleWrap },
                React.createElement(Text, { style: styles.title }, 'Mysore District Photographers and Videographers Association (MDPVA)'),
                React.createElement(Text, { style: styles.website }, 'mdpva.com')
              )
            ),
            React.createElement(Text, { style: styles.headerRight }, `Active members: ${activeCount}`)
          ),
          // Grid
          React.createElement(
            View,
            { style: styles.grid },
            ...cards
          ),
          // Footer
          React.createElement(
            View,
            { style: styles.footer, fixed: true },
            React.createElement(Text, { render: ({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}` }),
            React.createElement(Text, null, `Generated ${nowIST}`)
          )
        )
      )

      const stream = await pdf(PdfDoc).toBuffer()

      const pad = (n: number) => n.toString().padStart(2, '0')
      const now = new Date()
      const y = now.getFullYear()
      const m2 = pad(now.getMonth() + 1)
      const d2 = pad(now.getDate())
      const hh2 = pad(now.getHours())
      const mm2 = pad(now.getMinutes())
      const filename = `mdpva-members-${scope}-${y}${m2}${d2}-${hh2}${mm2}.pdf`

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    // Prepare streaming response (CSV)
    const ts = new TransformStream()
    const writer = ts.writable.getWriter()
    const encoder = new TextEncoder()
    const write = async (chunk: string) => {
      await writer.write(encoder.encode(chunk))
    }

    // Build filename
    const pad = (n: number) => n.toString().padStart(2, '0')
    const now = new Date()
    const y = now.getFullYear()
    const m = pad(now.getMonth() + 1)
    const d = pad(now.getDate())
    const hh = pad(now.getHours())
    const mm = pad(now.getMinutes())
    const filename = `mdpva-members-${scope}-${y}${m}${d}-${hh}${mm}-${total}.csv`

    // Kick off async writer
    ;(async () => {
      try {
        // UTF-8 BOM for Excel friendliness
        await write('\uFEFF')
        // Header
        await write(columns.join(',') + '\n')

        const pageSize = 1000
        let from = 0
        let more = true

        while (more) {
          let dataReq = supabase
            .from('members')
            .select(columns.join(','))
            .is('deleted_at', null)
            .range(from, from + pageSize - 1)

          if (scope === 'current') {
            // Search
            if (q) {
              const upper = q.toUpperCase()
              if (/^MDPVA/i.test(q)) {
                dataReq = dataReq.ilike('member_id', `${upper}%`)
              } else {
                dataReq = dataReq.or(
                  `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,member_id.ilike.%${q}%`
                )
              }
            }
            // Filter
            if (filter === 'active') dataReq = dataReq.eq('status', 'active')
            if (filter === 'inactive') dataReq = dataReq.eq('status', 'inactive')
            if (filter === 'newThisMonth') {
              const n2 = new Date()
              const firstOfMonth2 = new Date(n2.getFullYear(), n2.getMonth(), 1).toISOString()
              dataReq = dataReq.gte('created_at', firstOfMonth2)
            }
            // Sort
            switch (sortBy) {
              case 'created_asc':
                dataReq = dataReq.order('created_at', { ascending: true }).order('member_id', { ascending: true })
                break
              case 'name_asc':
                dataReq = dataReq.order('last_name', { ascending: true, nullsFirst: true }).order('first_name', { ascending: true, nullsFirst: true })
                break
              case 'name_desc':
                dataReq = dataReq.order('last_name', { ascending: false, nullsFirst: false }).order('first_name', { ascending: false, nullsFirst: false })
                break
              case 'updated_desc':
                dataReq = dataReq.order('updated_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
                break
              case 'id_asc':
                dataReq = dataReq.order('member_id', { ascending: true })
                break
              case 'id_desc':
                dataReq = dataReq.order('member_id', { ascending: false })
                break
              case 'created_desc':
              default:
                dataReq = dataReq.order('created_at', { ascending: false }).order('member_id', { ascending: false })
                break
            }
          } else {
            // scope === 'all' : deterministic default sort
            dataReq = dataReq.order('created_at', { ascending: false }).order('member_id', { ascending: false })
          }

          const { data, error } = await dataReq
          if (error) throw error

          const rows = (data as any[]) || []
          for (const row of rows) {
            const out: string[] = []
            for (const col of columns) {
              const v = (col === 'created_at' || col === 'updated_at') ? formatTimestampISO(row[col]) : row[col]
              out.push(csvEscape(v))
            }
            await write(out.join(',') + '\n')
          }

          from += pageSize
          if (rows.length < pageSize) {
            more = false
          }
        }
      } catch (err) {
        // Write an error marker line (best-effort) then close
        try { await write(`\n"ERROR","${(err as any)?.message || 'export failed'}"\n`) } catch {}
      } finally {
        try { await writer.close() } catch {}
      }
    })()

    const res = new NextResponse(ts.readable, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
    return res
  } catch (e: any) {
    return new NextResponse(`Failed to export members: ${e?.message || e}`, { status: 500 })
  }
}
