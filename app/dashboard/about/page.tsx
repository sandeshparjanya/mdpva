import Sidebar from '../../../components/Sidebar'
import ProfileMenu from '../../../components/ProfileMenu'
import { createServerClientSupabase } from '@/lib/supabaseServer'
import pkg from '../../../package.json'

export default async function AboutPage() {
  const supabase = createServerClientSupabase()

  let dbVersion: string | null = null
  try {
    const { data, error } = await supabase.rpc('get_pg_version')
    if (!error) dbVersion = (data as unknown as string) || null
  } catch {}

  const appName = 'MDPVA Admin Portal'
  const appVersion = (pkg as any)?.version || '0.0.0'
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || process.env.BUILD_TIME || null
  const lastDeployed = buildTime || (commitSha ? `commit ${commitSha}` : '—')

  return (
    <Sidebar>
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex justify-between items-start">
          <div>
            <nav className="flex text-sm text-gray-500 dark:text-gray-400 mb-2">
              <span>Dashboard</span>
              <span className="mx-2">/</span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">About</span>
            </nav>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">About</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Application and environment details</p>
          </div>
          <div className="flex items-center">
            <ProfileMenu className="hidden lg:inline-block" />
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6 w-full max-w-2xl">
          <InfoRow label="App name" value={appName} />
          <InfoRow label="App version" value={appVersion} />
          <InfoRow label="Database" value={dbVersion || '—'} hint="PostgreSQL (sanitized)" />
          <InfoRow label="Last deployed" value={lastDeployed} />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">Note: Database version is sanitized and does not reveal the hosted provider.</p>
        </div>
      </div>
    </Sidebar>
  )
}

function InfoRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="py-3 flex items-start justify-between">
      <div className="text-sm text-gray-600 dark:text-gray-300">{label}{hint ? <span className="ml-2 text-gray-400 dark:text-gray-400">({hint})</span> : null}</div>
      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  )
}
