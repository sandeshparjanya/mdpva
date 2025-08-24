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
      'address_line1', 'address_line2', 'area', 'city', 'state', 'pincode', 'dob', 'blood_group', 'created_at', 'updated_at'
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
        business_name: string | null
        address_line1: string | null
        address_line2: string | null
        area: string | null
        city: string | null
        state: string | null
        pincode: string | null
        status: string | null
        created_at: string | null
        profile_photo_url?: string | null
      }

      const selectCols = [
        'member_id',
        'first_name',
        'last_name',
        'phone',
        'business_name',
        'address_line1',
        'address_line2',
        'area',
        'city',
        'state',
        'pincode',
        'status',
        'created_at',
        'profile_photo_url',
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
        // Cast via any to avoid TS complaining about Supabase generic typing
        const rows = ((data as any) as Row[]) || []
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
          // Ask Supabase image transform for a portrait-friendly, non-cropping thumbnail
          // These params are ignored if unsupported by the CDN, but are safe to include
          u.searchParams.set('width', '108')
          u.searchParams.set('height', '144')
          u.searchParams.set('resize', 'contain')
          u.searchParams.set('background', 'ffffff')
          u.searchParams.set('quality', '75')
          return u.toString()
        } catch {
          return url
        }
      }

      // Styles for portrait A4 table layout
      const styles = StyleSheet.create({
        page: {
          paddingTop: 28,
          paddingBottom: 36,
          paddingHorizontal: 20,
          flexDirection: 'column',
        },
        header: {
          marginBottom: 10,
        },
        headerRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        logoBox: { width: 48, height: 48, backgroundColor: '#e5e7eb', borderRadius: 4, marginRight: 10 },
        headerTextWrap: { flexDirection: 'column', flexGrow: 1 },
        headerTitleBlue: { fontSize: 14, color: '#1e3a8a', fontWeight: 700 },
        headerTitleRed: { fontSize: 14, color: '#dc2626', fontWeight: 700 },
        subTitle: { fontSize: 9, color: '#374151', marginTop: 2 },
        table: {
          borderWidth: 0.5,
          borderColor: '#9ca3af',
          marginTop: 56,
        },
        row: {
          flexDirection: 'row',
        },
        headerCell: {
          backgroundColor: '#e5f4ff',
          fontWeight: 700,
        },
        cell: {
          borderRightWidth: 0.5,
          borderBottomWidth: 0.5,
          borderColor: '#9ca3af',
          paddingVertical: 6,
          paddingHorizontal: 6,
          fontSize: 8,
          justifyContent: 'center',
        },
        cMemberId: { width: '16%' },
        cNameAddr: { width: '58%' },
        cPhone: { width: '16%' },
        cPhoto: { width: '10%', alignItems: 'center', justifyContent: 'center' },
        nameLine: { fontSize: 9, fontWeight: 700 },
        addrLine: { fontSize: 8 },
        photo: { width: 54, height: 72, objectFit: 'contain', backgroundColor: '#f3f4f6', borderRadius: 2 },
        footer: { position: 'absolute', bottom: 12, left: 20, right: 20, fontSize: 8, color: '#4b5563', flexDirection: 'row', justifyContent: 'space-between' },
      })

      // Fonts (optional: system fonts usually OK in many viewers)
      // If needed, register a font here via Font.register

      const nowIST = formatInTimeZone(new Date(), 'Asia/Kolkata', 'dd-MM-yyyy HH:mm zzz')

      // Build table header
      const tableHeader = React.createElement(
        View,
        { style: [styles.row, styles.headerCell] },
        React.createElement(Text, { style: [styles.cell, styles.cMemberId] }, 'Member ID'),
        React.createElement(Text, { style: [styles.cell, styles.cNameAddr] }, 'Name & address'),
        React.createElement(Text, { style: [styles.cell, styles.cPhone] }, 'Phone No'),
        React.createElement(Text, { style: [styles.cell, styles.cPhoto] }, 'Photo')
      )

      const tableRows = allRows.map((m, idx) => {
        const name = `${(m.first_name || '').trim()}${m.last_name ? ' ' + m.last_name.trim() : ''}`.trim()
        // Build subsequent lines without duplicating the name
        const parts: string[] = []
        const norm = (s?: string | null) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase()
        const nameNorm = norm(name)
        const pushIfDistinct = (val?: string | null) => {
          const v = (val || '').trim()
          if (!v) return
          const vNorm = v.replace(/\s+/g, ' ').toLowerCase()
          if (vNorm === nameNorm) return
          if (parts.some(p => p.trim().replace(/\s+/g, ' ').toLowerCase() === vNorm)) return
          parts.push(v)
        }
        pushIfDistinct(m.business_name)
        pushIfDistinct(m.address_line1)
        pushIfDistinct(m.address_line2)
        const cityState = [m.area || '', m.city || '', m.state || ''].filter(Boolean).join(', ')
        const pin = m.pincode ? ` ${m.pincode}` : ''
        pushIfDistinct((cityState + pin).trim())

        return React.createElement(
          View,
          { key: m.member_id + '-' + idx, style: styles.row },
          React.createElement(Text, { style: [styles.cell, styles.cMemberId] }, m.member_id),
          React.createElement(
            View,
            { style: [styles.cell, styles.cNameAddr] },
            React.createElement(Text, { style: styles.nameLine }, name),
            React.createElement(Text, { style: styles.addrLine }, parts.join('\n')),
          ),
          React.createElement(Text, { style: [styles.cell, styles.cPhone] }, m.phone || ''),
          React.createElement(
            View,
            { style: [styles.cell, styles.cPhoto] },
            m.profile_photo_url
              ? React.createElement(Image, { src: toThumb(m.profile_photo_url) || '', style: styles.photo })
              : React.createElement(View, { style: styles.photo })
          ),
        )
      })

      const PdfDoc = React.createElement(
        Document,
        null,
        React.createElement(
          Page,
          { size: 'A4', orientation: 'portrait', style: styles.page },
          // Header
          React.createElement(
            View,
            { style: styles.header, fixed: true },
            React.createElement(
              View,
              { style: styles.headerRow },
              React.createElement(View, { style: styles.logoBox }),
              React.createElement(
                View,
                { style: styles.headerTextWrap },
                React.createElement(Text, { style: styles.headerTitleBlue }, 'MYSURU DISTRICT PHOTOGRAPHERS &'),
                React.createElement(Text, { style: styles.headerTitleRed }, 'VIDEOGRAPHERS ASSOCIATION (MDPVA)')
              )
            ),
            React.createElement(Text, { style: styles.subTitle }, 'Members list')
          ),
          // Table
          React.createElement(
            View,
            { style: styles.table },
            tableHeader,
            ...tableRows
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

      // Render to a Buffer (Node) and return as BodyInit. Type cast avoids TS mismatch between
      // @react-pdf/renderer type defs and Node Response BodyInit on Vercel.
      const pdfBuffer = await (pdf(PdfDoc) as any).toBuffer()

      const pad = (n: number) => n.toString().padStart(2, '0')
      const now = new Date()
      const y = now.getFullYear()
      const m2 = pad(now.getMonth() + 1)
      const d2 = pad(now.getDate())
      const hh2 = pad(now.getHours())
      const mm2 = pad(now.getMinutes())
      const filename = `mdpva-members-${scope}-${y}${m2}${d2}-${hh2}${mm2}.pdf`

      return new NextResponse(pdfBuffer as any, {
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
