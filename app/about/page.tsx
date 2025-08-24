import { createServerClientSupabase } from '@/lib/supabaseServer'
import pkg from '../../package.json'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function AboutPage() {
  const supabase = createServerClientSupabase()

  let dbVersion: string | null = null
  try {
    const { data, error } = await supabase.rpc('get_pg_version')
    if (!error) dbVersion = (data as unknown as string) || null
  } catch {}

  const appName = 'MDPVA Admin Portal'
  const appVersion = (pkg as any)?.version || '0.0.0'
  const deployEnv = process.env.VERCEL_ENV || (process.env.VERCEL ? 'production' : 'local')
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || process.env.BUILD_TIME || null

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">About</h1>
        <div className="divide-y divide-gray-200">
          <InfoRow label="App name" value={appName} />
          <InfoRow label="App version" value={appVersion} />
          <InfoRow label="Database" value={dbVersion || '—'} hint="PostgreSQL (sanitized)" />
          <InfoRow label="Environment" value={deployEnv} />
          <InfoRow label="Last deployed" value={buildTime || (commitSha ? `commit ${commitSha}` : '—')} />
        </div>
        <p className="text-xs text-gray-500 mt-4">Note: Database version is sanitized and does not reveal the hosted provider.</p>
      </div>
    </div>
  )
}

function InfoRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="py-3 flex items-start justify-between">
      <div className="text-sm text-gray-600">{label}{hint ? <span className="ml-2 text-gray-400">({hint})</span> : null}</div>
      <div className="text-sm font-medium text-gray-900">{value}</div>
    </div>
  )
}
