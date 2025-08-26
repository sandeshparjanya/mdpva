'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Sidebar from '../../../../components/Sidebar'

// Scaffold for Bulk Import flow: Upload -> Mapping -> Options -> Dry-run -> Apply
export default function MembersImportPage() {
  const steps = ['Upload', 'Mapping', 'Options', 'Dry-run', 'Apply'] as const
  type Step = typeof steps[number]

  const [activeStep, setActiveStep] = useState<Step>('Upload')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<null | {
    headers: string[]
    totalRows: number
    preview: Record<string, string>[]
    required: string[]
    missingRequired: string[]
    suggestions: Record<string, string | null>
    fileName: string
    fileSize: number
  }>(null)
  // Mapping: CSV header -> target field key or 'ignore'
  const TARGET_FIELDS: { key: string; label: string; required?: boolean }[] = [
    { key: 'first_name', label: 'First Name', required: true },
    { key: 'last_name', label: 'Last Name', required: true },
    { key: 'email', label: 'Email', required: true },
    { key: 'phone', label: 'Phone', required: true },
    { key: 'profession', label: 'Profession', required: true },
    { key: 'business_name', label: 'Business Name' },
    { key: 'address_line1', label: 'Address Line 1', required: true },
    { key: 'address_line2', label: 'Address Line 2' },
    { key: 'pincode', label: 'Pincode', required: true },
    { key: 'area', label: 'Area' },
    { key: 'city', label: 'City', required: true },
    { key: 'state', label: 'State', required: true },
    { key: 'status', label: 'Status', required: true },
    { key: 'dob', label: 'Date of Birth (dd/mm/yyyy)' },
    { key: 'blood_group', label: 'Blood Group' },
    { key: 'notes', label: 'Notes' },
  ]
  const REQUIRED_KEYS = useMemo(() => TARGET_FIELDS.filter(f => f.required).map(f => f.key), [])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [duplicatePolicy, setDuplicatePolicy] = useState<'skip' | 'update' | 'undelete'>('skip')
  const [dryRunLoading, setDryRunLoading] = useState(false)
  const [dryRunError, setDryRunError] = useState<string | null>(null)
  const [dryRunResult, setDryRunResult] = useState<null | {
    summary: { total: number; valid: number; invalid: number; duplicateWithinFile: number; duplicateExisting: number }
    errors: { row: number; issues: string[] }[]
  }>(null)
  const [applyLoading, setApplyLoading] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [applyResult, setApplyResult] = useState<null | {
    summary: { total: number; created: number; updated: number; skipped: number; undeleted: number; failed: number }
    results: { row: number; status: 'created' | 'updated' | 'skipped' | 'undeleted' | 'failed'; reason?: string }[]
  }>(null)

  const canGoBack = steps.indexOf(activeStep) > 0
  const canGoNext = steps.indexOf(activeStep) < steps.length - 1

  const goNext = () => {
    const idx = steps.indexOf(activeStep)
    if (idx < steps.length - 1) setActiveStep(steps[idx + 1])
  }

  const goBack = () => {
    const idx = steps.indexOf(activeStep)
    if (idx > 0) setActiveStep(steps[idx - 1])
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null)
    setAnalysis(null)
    setDryRunResult(null)
    setDryRunError(null)
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    const form = new FormData()
    form.append('file', file)
    setUploading(true)
    try {
      const res = await fetch('/api/members/import?dryRun=true&phase=headers', {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt || `Upload failed (${res.status})`)
      }
      const json = await res.json()
      setAnalysis(json)
    } catch (err: any) {
      setError(err?.message || 'Failed to analyze file')
    } finally {
      setUploading(false)
    }
  }

  const canProceedFromUpload = useMemo(() => {
    if (!analysis) return false
    return analysis.missingRequired.length === 0
  }, [analysis])

  // Build default mapping suggestions when analysis loads
  useEffect(() => {
    if (!analysis) return
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '_')
    const suggestions: Record<string, string> = {}
    const availableKeys = new Set(TARGET_FIELDS.map(f => f.key))
    const synonyms: Record<string, string> = {
      firstname: 'first_name',
      'first-name': 'first_name',
      lastname: 'last_name',
      'last-name': 'last_name',
      mobile: 'phone',
      'phone_number': 'phone',
      profession: 'profession',
      business: 'business_name',
      addr1: 'address_line1',
      address1: 'address_line1',
      addr2: 'address_line2',
      address2: 'address_line2',
      pin: 'pincode',
      postalcode: 'pincode',
      postcode: 'pincode',
      locality: 'area',
      town: 'city',
      city: 'city',
      state: 'state',
      status: 'status',
      dob: 'dob',
      'date_of_birth': 'dob',
      bloodgroup: 'blood_group',
      notes: 'notes',
    }
    for (const h of analysis.headers) {
      const n = norm(h)
      if (availableKeys.has(n)) {
        suggestions[h] = n
      } else if (synonyms[n]) {
        suggestions[h] = synonyms[n]
      } else {
        suggestions[h] = 'ignore'
      }
    }
    setMapping(suggestions)
  }, [analysis])

  const canProceedFromMapping = useMemo(() => {
    if (!analysis) return false
    const selected = new Set(Object.values(mapping).filter(v => v && v !== 'ignore'))
    return REQUIRED_KEYS.every(k => selected.has(k))
  }, [mapping, analysis, REQUIRED_KEYS])

  // Trigger dry-run rows validation when entering Dry-run step
  useEffect(() => {
    const run = async () => {
      if (activeStep !== 'Dry-run') return
      if (!selectedFile || !analysis) return
      setDryRunLoading(true)
      setDryRunError(null)
      setDryRunResult(null)
      try {
        const form = new FormData()
        form.append('file', selectedFile)
        form.append('mapping', JSON.stringify(mapping))
        form.append('duplicatePolicy', duplicatePolicy)
        const res = await fetch('/api/members/import?dryRun=true&phase=rows', {
          method: 'POST',
          body: form,
        })
        if (!res.ok) {
          const txt = await res.text()
          throw new Error(txt || `Dry-run failed (${res.status})`)
        }
        const json = await res.json()
        setDryRunResult({ summary: json.summary, errors: json.errors || [] })
      } catch (err: any) {
        setDryRunError(err?.message || 'Failed to run dry-run validation')
      } finally {
        setDryRunLoading(false)
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep])

  async function handleApply() {
    if (!selectedFile || !analysis) {
      setApplyError('No file or analysis context. Go back to Upload.')
      return
    }
    setApplyLoading(true)
    setApplyError(null)
    setApplyResult(null)
    try {
      const form = new FormData()
      form.append('file', selectedFile)
      form.append('mapping', JSON.stringify(mapping))
      form.append('duplicatePolicy', duplicatePolicy)
      const res = await fetch('/api/members/import', { method: 'POST', body: form })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt || `Apply failed (${res.status})`)
      }
      const json = await res.json()
      setApplyResult({ summary: json.summary, results: json.results || [] })
    } catch (err: any) {
      setApplyError(err?.message || 'Failed to apply import')
    } finally {
      setApplyLoading(false)
    }
  }

  return (
    <Sidebar>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {/* Breadcrumb */}
            <nav className="flex text-sm text-gray-500 mb-2" aria-label="Breadcrumb">
              <Link href="/dashboard" className="hover:underline">Dashboard</Link>
              <span className="mx-2">/</span>
              <Link href="/dashboard/members" className="hover:underline">Members</Link>
              <span className="mx-2">/</span>
              <span className="text-gray-900 font-medium">Import</span>
            </nav>
            <h1 className="text-2xl font-bold text-gray-900">Import Members</h1>
            <p className="text-sm text-gray-600 mt-1">Upload a CSV, map columns, dry-run validation, and import members in bulk.</p>
          </div>
          <div className="w-full sm:w-auto flex flex-wrap items-center gap-2">
            <Link href="/samples/members-import-sample.csv" className="btn-secondary w-full sm:w-auto" prefetch={false}>
              Download CSV Template
            </Link>
            <Link href="/dashboard/members" className="btn-secondary w-full sm:w-auto">Back to Members</Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Stepper */}
        <ol className="flex items-center w-full text-sm text-gray-600 overflow-x-auto" role="list">
          {steps.map((s, i) => {
            const isActive = s === activeStep
            const isComplete = steps.indexOf(activeStep) > i
            return (
              <li key={s} className="flex items-center">
                <button
                  type="button"
                  className={`flex items-center px-2 py-1 rounded ${isActive ? 'text-blue-700 font-medium' : isComplete ? 'text-green-700' : 'text-gray-600'} hover:bg-gray-50`}
                  onClick={() => { if (isComplete) setActiveStep(s) }}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span className={`w-6 h-6 mr-2 rounded-full border flex items-center justify-center text-xs ${isActive ? 'border-blue-500 text-blue-700' : isComplete ? 'border-green-500 text-green-700' : 'border-gray-300 text-gray-500'}`}>
                    {i + 1}
                  </span>
                  {s}
                </button>
                {i < steps.length - 1 && <span className="mx-2 text-gray-300">→</span>}
              </li>
            )
          })}
        </ol>

        {/* Panels */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          {activeStep === 'Upload' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Step 1: Upload CSV</h2>
              <p className="text-sm text-gray-600">Select your CSV file (max 10MB). Use the template to ensure correct columns. We will only analyze until you confirm.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CSV File</label>
                <input type="file" accept=".csv" className="block w-full text-sm" onChange={handleFileChange} />
              </div>
              {uploading && (
                <p className="text-sm text-blue-700">Analyzing file…</p>
              )}
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
              {analysis && (
                <div className="border rounded p-3 bg-gray-50">
                  <div className="text-sm text-gray-800 mb-2">
                    <span className="font-medium">File:</span> {analysis.fileName} · {(analysis.fileSize / 1024).toFixed(1)} KB
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="p-2 bg-white rounded border">
                      <div className="text-gray-500">Headers</div>
                      <div className="font-medium">{analysis.headers.length}</div>
                    </div>
                    <div className="p-2 bg-white rounded border">
                      <div className="text-gray-500">Total Rows</div>
                      <div className="font-medium">{analysis.totalRows}</div>
                    </div>
                    <div className="p-2 bg-white rounded border">
                      <div className="text-gray-500">Missing Required</div>
                      <div className={`font-medium ${analysis.missingRequired.length ? 'text-red-600' : 'text-green-700'}`}>{analysis.missingRequired.length}</div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm">
                    <div className="font-medium">Required fields</div>
                    <div className="text-gray-700">{analysis.required.join(', ')}</div>
                  </div>
                  {!!analysis.missingRequired.length && (
                    <div className="mt-2 text-sm text-red-700">
                      Missing: {analysis.missingRequired.join(', ')}
                    </div>
                  )}
                  <div className="mt-3">
                    <div className="text-sm font-medium mb-1">Preview (first 5 rows)</div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs border">
                        <thead className="bg-gray-100">
                          <tr>
                            {analysis.headers.map(h => (
                              <th key={h} className="px-2 py-1 text-left border-b">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.preview.map((row, idx) => (
                            <tr key={idx} className="border-t">
                              {analysis.headers.map(h => (
                                <td key={h} className="px-2 py-1 align-top">{row[h] ?? ''}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-500">We’ll parse this on the server; no data will be written until you review the dry-run.</p>
            </div>
          )}

          {activeStep === 'Mapping' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Step 2: Map Columns</h2>
              <p className="text-sm text-gray-600">Map your CSV headers to member fields. Required fields must be mapped. DOB must be in <span className="font-medium">dd/mm/yyyy</span> format.</p>
              {!analysis ? (
                <div className="p-3 rounded bg-yellow-50 border text-sm text-yellow-800">Upload a file first.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left border-b">CSV Header</th>
                        <th className="px-3 py-2 text-left border-b">Map to field</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.headers.map((h) => (
                        <tr key={h} className="border-t">
                          <td className="px-3 py-2 align-top font-mono text-xs">{h}</td>
                          <td className="px-3 py-2">
                            <select
                              className="border rounded px-2 py-1 text-sm"
                              value={mapping[h] ?? 'ignore'}
                              onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))}
                            >
                              <option value="ignore">Ignore</option>
                              {TARGET_FIELDS.map(f => (
                                <option key={f.key} value={f.key}>
                                  {f.label}{f.required ? ' *' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-3 text-sm">
                    <span className="font-medium">Required:</span> {TARGET_FIELDS.filter(f => f.required).map(f => f.label).join(', ')}
                  </div>
                  {!canProceedFromMapping && (
                    <div className="mt-2 text-sm text-red-700">Map all required fields to proceed.</div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeStep === 'Options' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Step 3: Options</h2>
              <div className="space-y-2">
                <div className="text-sm text-gray-700 font-medium">Duplicate Policy</div>
                <div className="flex items-center gap-6 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name="dupe" value="skip" checked={duplicatePolicy==='skip'} onChange={() => setDuplicatePolicy('skip')} />
                    <span>Skip (default)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 opacity-90">
                    <input type="radio" name="dupe" value="update" checked={duplicatePolicy==='update'} onChange={() => setDuplicatePolicy('update')} />
                    <span>Update</span>
                  </label>
                  <label className="inline-flex items-center gap-2 opacity-90">
                    <input type="radio" name="dupe" value="undelete" checked={duplicatePolicy==='undelete'} onChange={() => setDuplicatePolicy('undelete')} />
                    <span>Undelete (if previously soft-deleted)</span>
                  </label>
                </div>
                <div className="text-xs text-gray-500">Photos are skipped for now. You can add photos later individually.</div>
                <div className="text-xs text-gray-500">DOB format: <span className="font-medium">dd/mm/yyyy</span>.</div>
              </div>
            </div>
          )}

          {activeStep === 'Dry-run' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Step 4: Dry-run Validation</h2>
              <p className="text-sm text-gray-600">We validate mapped rows, check duplicates and formats (including DOB dd/mm/yyyy), and summarize results.</p>
              {!selectedFile && (
                <div className="p-3 rounded bg-yellow-50 border text-sm text-yellow-800">No file selected. Go back to Upload.</div>
              )}
              {dryRunLoading && (
                <div className="text-sm text-blue-700">Running dry-run…</div>
              )}
              {dryRunError && (
                <div className="text-sm text-red-700">{dryRunError}</div>
              )}
              {dryRunResult && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div className="p-2 bg-white rounded border">
                      <div className="text-gray-500">Total</div>
                      <div className="font-medium">{dryRunResult.summary.total}</div>
                    </div>
                    <div className="p-2 bg-white rounded border">
                      <div className="text-gray-500">Valid</div>
                      <div className="font-medium text-green-700">{dryRunResult.summary.valid}</div>
                    </div>
                    <div className="p-2 bg-white rounded border">
                      <div className="text-gray-500">Invalid</div>
                      <div className="font-medium text-red-700">{dryRunResult.summary.invalid}</div>
                    </div>
                    <div className="p-2 bg-white rounded border">
                      <div className="text-gray-500">Dup (within file)</div>
                      <div className="font-medium">{dryRunResult.summary.duplicateWithinFile}</div>
                    </div>
                    <div className="p-2 bg-white rounded border">
                      <div className="text-gray-500">Dup (existing)</div>
                      <div className="font-medium">{dryRunResult.summary.duplicateExisting}</div>
                    </div>
                  </div>
                  {!!dryRunResult.errors.length && (
                    <div className="text-sm">
                      <div className="font-medium mb-1">Errors (first 20)</div>
                      <div className="max-h-64 overflow-auto border rounded">
                        <table className="min-w-full text-xs">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-2 py-1 text-left border-b">Row</th>
                              <th className="px-2 py-1 text-left border-b">Issues</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dryRunResult.errors.slice(0,20).map((e) => (
                              <tr key={e.row} className="border-t">
                                <td className="px-2 py-1">{e.row}</td>
                                <td className="px-2 py-1">{e.issues.join('; ')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeStep === 'Apply' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Step 5: Apply Import</h2>
              <p className="text-sm text-gray-600">We’ll create/update members in batches and show a summary upon completion.</p>
              {!selectedFile && (
                <div className="p-3 rounded bg-yellow-50 border text-sm text-yellow-800">No file selected. Go back to Upload.</div>
              )}
              <div className="flex items-center gap-3">
                <button className="btn-primary" onClick={handleApply} disabled={!selectedFile || applyLoading}>
                  {applyLoading ? 'Importing…' : 'Start Import'}
                </button>
                {applyError && <div className="text-sm text-red-700">{applyError}</div>}
              </div>
              {applyResult && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
                    <div className="p-2 bg-white rounded border">
                      <div className="text-gray-500">Total</div>
                      <div className="font-medium">{applyResult.summary.total}</div>
                    </div>
                    <div className="p-2 bg-white rounded border">
                      <div className="text-gray-500">Created</div>
                      <div className="font-medium text-green-700">{applyResult.summary.created}</div>
                    </div>
                    <div className="p-2 bg-white rounded border">
                      <div className="text-gray-500">Updated</div>
                      <div className="font-medium text-blue-700">{applyResult.summary.updated}</div>
                    </div>
                    <div className="p-2 bg-white rounded border">
                      <div className="text-gray-500">Undeleted</div>
                      <div className="font-medium text-purple-700">{applyResult.summary.undeleted}</div>
                    </div>
                    <div className="p-2 bg-white rounded border">
                      <div className="text-gray-500">Skipped</div>
                      <div className="font-medium">{applyResult.summary.skipped}</div>
                    </div>
                    <div className="p-2 bg-white rounded border">
                      <div className="text-gray-500">Failed</div>
                      <div className="font-medium text-red-700">{applyResult.summary.failed}</div>
                    </div>
                  </div>
                  {!!applyResult.results.length && (
                    <div className="text-sm">
                      <div className="font-medium mb-1">Row results (first 20)</div>
                      <div className="max-h-64 overflow-auto border rounded">
                        <table className="min-w-full text-xs">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-2 py-1 text-left border-b">Row</th>
                              <th className="px-2 py-1 text-left border-b">Status</th>
                              <th className="px-2 py-1 text-left border-b">Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {applyResult.results.slice(0,20).map((r, idx) => (
                              <tr key={idx} className="border-t">
                                <td className="px-2 py-1">{r.row}</td>
                                <td className="px-2 py-1">{r.status}</td>
                                <td className="px-2 py-1">{r.reason || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Nav buttons */}
        <div className="flex items-center justify-between">
          <button className="btn-secondary" onClick={goBack} disabled={!canGoBack}>Back</button>
          {activeStep === 'Apply' ? (
            applyResult && !applyLoading ? (
              <Link
                href="/dashboard/members"
                className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white font-medium"
              >
                Done
              </Link>
            ) : (
              <div />
            )
          ) : (
            <button
              className="btn-primary"
              onClick={goNext}
              disabled={
                !canGoNext ||
                (activeStep === 'Upload' && !canProceedFromUpload) ||
                (activeStep === 'Mapping' && !canProceedFromMapping) ||
                (activeStep === 'Dry-run' && (dryRunLoading || !dryRunResult))
              }
            >
              Next
            </button>
          )}
        </div>
      </div>
    </Sidebar>
  )
}
