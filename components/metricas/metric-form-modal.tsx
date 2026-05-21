'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type PerformanceMetric, type Client, type Platform } from '@/types/index'
import { X, Upload, FileText, Check } from 'lucide-react'
import Papa from 'papaparse'

interface Props {
  clients: Pick<Client, 'id' | 'name'>[]
  currentUserId: string
  defaultClientId?: string
  onClose: () => void
  onSave: (metric: PerformanceMetric) => void
}

// Keywords for auto-detecting CSV columns (case insensitive, order matters — more specific first)
const AUTO_DETECT: Record<string, string[]> = {
  spend:           ['importe gastado', 'gasto total', 'spend', 'monto gastado', 'total gastado'],
  impressions:     ['impresiones', 'impressions'],
  clicks:          ['clics únicos en el enlace', 'clics en el enlace', 'clic único', 'link clicks',
                    'conversaciones con mensajes', 'contactos de mensajes', 'clic', 'click'],
  ctr:             ['ctr (tasa', 'ctr (porcentaje', 'ctr del enlace', 'tasa de clics', 'click-through', 'ctr'],
  cpc:             ['cpc (costo', 'cpc (cost', 'costo por clic único', 'cost per unique click', 'cpc'],
  conversions:     ['resultados', 'conversiones', 'conversions', 'results'],
  cost_per_result: ['costo por resultado', 'costo por conversación', 'costo por compra',
                    'cost per result', 'costo / conv', 'costo/conv', 'costo por conv'],
  conversion_rate: ['tasa de convers', 'conversion rate', 'tasa conv', 'roas'],
}

type MetricField = 'spend' | 'impressions' | 'clicks' | 'ctr' | 'cpc' | 'conversions' | 'cost_per_result' | 'conversion_rate'
const METRIC_FIELDS: { key: MetricField; label: string; aggregation: 'sum' | 'avg' }[] = [
  { key: 'spend',           label: 'Inversión',            aggregation: 'sum' },
  { key: 'impressions',     label: 'Impresiones',          aggregation: 'sum' },
  { key: 'clicks',          label: 'Clics',                aggregation: 'sum' },
  { key: 'ctr',             label: 'CTR (%)',              aggregation: 'avg' },
  { key: 'cpc',             label: 'CPC',                  aggregation: 'avg' },
  { key: 'conversions',     label: 'Conversiones',         aggregation: 'sum' },
  { key: 'cost_per_result', label: 'Costo por resultado',  aggregation: 'avg' },
  { key: 'conversion_rate', label: 'Tasa de conversión (%)', aggregation: 'avg' },
]

function cleanNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null
  const s = String(val).replace(/[$ %,]/g, '').trim()
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function detectColumn(header: string, field: string): boolean {
  const h = header.toLowerCase().trim()
  // Sort keywords longest-first so specific matches win over partial ones
  const keywords = [...(AUTO_DETECT[field] ?? [])].sort((a, b) => b.length - a.length)
  return keywords.some((kw) => h.includes(kw.toLowerCase()))
}

export function MetricFormModal({ clients, currentUserId, defaultClientId, onClose, onSave }: Props) {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<'manual' | 'csv'>('manual')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Shared form state
  const [clientId, setClientId] = useState(defaultClientId ?? '')
  const [platform, setPlatform] = useState<Platform>('meta_ads')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')

  // Manual entry
  const [manualValues, setManualValues] = useState<Record<MetricField, string>>({
    spend: '', impressions: '', clicks: '', ctr: '',
    cpc: '', conversions: '', cost_per_result: '', conversion_rate: '',
  })

  // CSV state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([])
  const [columnMap, setColumnMap] = useState<Record<MetricField, string>>({
    spend: '', impressions: '', clicks: '', ctr: '',
    cpc: '', conversions: '', cost_per_result: '', conversion_rate: '',
  })
  const [csvParsed, setCsvParsed] = useState(false)
  const [previewValues, setPreviewValues] = useState<Record<MetricField, number | null> | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setCsvParsed(false)
    setPreviewValues(null)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const headers = results.meta.fields ?? []
        const rows = results.data as Record<string, string>[]
        setCsvHeaders(headers)
        setCsvRows(rows)

        // Auto-detect column mapping — track used headers to avoid double-assignment
        const detected: Record<MetricField, string> = {
          spend: '', impressions: '', clicks: '', ctr: '',
          cpc: '', conversions: '', cost_per_result: '', conversion_rate: '',
        }
        const used = new Set<string>()
        for (const field of Object.keys(detected) as MetricField[]) {
          const match = headers.find((h) => !used.has(h) && detectColumn(h, field))
          if (match) { detected[field] = match; used.add(match) }
        }
        setColumnMap(detected)
        setCsvParsed(true)
      },
      error() {
        setError('No se pudo leer el archivo CSV.')
      },
    })
  }

  function computePreview() {
    const result: Record<MetricField, number | null> = {
      spend: null, impressions: null, clicks: null, ctr: null,
      cpc: null, conversions: null, cost_per_result: null, conversion_rate: null,
    }

    // Check for a total row (row where the first column contains "total")
    const firstHeader = csvHeaders[0]
    const totalRow = csvRows.find((r) =>
      String(r[firstHeader] ?? '').toLowerCase().includes('total')
    )
    const dataRows = totalRow ? [totalRow] : csvRows

    for (const field of METRIC_FIELDS) {
      const col = columnMap[field.key]
      if (!col) continue
      const nums = dataRows.map((r) => cleanNumber(r[col])).filter((n): n is number => n !== null)
      if (nums.length === 0) continue
      if (field.aggregation === 'sum' || dataRows.length === 1) {
        result[field.key] = nums.reduce((s, n) => s + n, 0)
      } else {
        result[field.key] = nums.reduce((s, n) => s + n, 0) / nums.length
      }
    }

    setPreviewValues(result)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId || !periodStart || !periodEnd) {
      setError('Cliente y período son obligatorios.')
      return
    }
    setLoading(true)
    setError(null)

    let payload: Record<string, unknown>

    if (tab === 'manual') {
      payload = {
        client_id: clientId,
        uploaded_by: currentUserId,
        platform,
        period_start: periodStart,
        period_end: periodEnd,
        spend: cleanNumber(manualValues.spend),
        impressions: cleanNumber(manualValues.impressions),
        clicks: cleanNumber(manualValues.clicks),
        ctr: cleanNumber(manualValues.ctr),
        cpc: cleanNumber(manualValues.cpc),
        conversions: cleanNumber(manualValues.conversions),
        cost_per_result: cleanNumber(manualValues.cost_per_result),
        conversion_rate: cleanNumber(manualValues.conversion_rate),
      }
    } else {
      if (!previewValues) { setError('Calculá la vista previa primero.'); setLoading(false); return }
      payload = {
        client_id: clientId,
        uploaded_by: currentUserId,
        platform,
        period_start: periodStart,
        period_end: periodEnd,
        ...previewValues,
        raw_data: { rows_count: csvRows.length, column_map: columnMap },
      }
    }

    const { data, error: err } = await supabase
      .from('performance_metrics')
      .upsert(payload, { onConflict: 'client_id,period_start,period_end,platform' })
      .select().single()

    if (err) { setError(err.message); setLoading(false); return }
    onSave(data as PerformanceMetric)
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-yesica/50'
  const labelCls = 'block text-xs font-medium text-muted mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-xl w-full max-w-lg shadow-2xl mb-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text">Agregar métricas de rendimiento</h2>
          <button onClick={onClose} className="text-muted hover:text-text transition-colors"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {(['manual', 'csv'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                tab === t
                  ? 'text-yesica border-b-2 border-yesica -mb-px'
                  : 'text-muted hover:text-text'
              }`}
            >
              {t === 'manual' ? 'Entrada manual' : 'Subir CSV'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Shared: Client + Platform + Period */}
          <div>
            <label className={labelCls}>Cliente <span className="text-danger">*</span></label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
              <option value="">— Seleccionar —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Plataforma</label>
            <div className="flex gap-2">
              {(['meta_ads', 'google_ads'] as Platform[]).map((p) => (
                <button
                  key={p} type="button" onClick={() => setPlatform(p)}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    platform === p
                      ? 'bg-yesica/15 text-yesica border-yesica/30'
                      : 'bg-surface-2 text-muted border-border hover:border-muted'
                  }`}
                >
                  {p === 'meta_ads' ? 'Meta Ads' : 'Google Ads'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Inicio período <span className="text-danger">*</span></label>
              <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fin período <span className="text-danger">*</span></label>
              <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required className={inputCls} />
            </div>
          </div>

          {/* Manual tab */}
          {tab === 'manual' && (
            <div className="grid grid-cols-2 gap-3">
              {METRIC_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className={labelCls}>{f.label}</label>
                  <input
                    type="number" step="any" value={manualValues[f.key]}
                    onChange={(e) => setManualValues((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder="—"
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          )}

          {/* CSV tab */}
          {tab === 'csv' && (
            <div className="space-y-4">
              {/* File input */}
              <div>
                <label className={labelCls}>Archivo CSV</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-border hover:border-yesica/40 rounded-lg cursor-pointer transition-colors"
                >
                  <Upload size={20} className="text-muted" />
                  <p className="text-sm text-muted">
                    {csvParsed
                      ? <span className="flex items-center gap-1.5 text-success"><Check size={14} /> {csvRows.length} filas detectadas</span>
                      : 'Clic para seleccionar CSV'
                    }
                  </p>
                </div>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
              </div>

              {/* Column mapping */}
              {csvParsed && csvHeaders.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted">Mapeo de columnas</p>
                  {METRIC_FIELDS.map((f) => (
                    <div key={f.key} className="flex items-center gap-2">
                      <label className="text-xs text-text w-36 flex-shrink-0">{f.label}</label>
                      <select
                        value={columnMap[f.key]}
                        onChange={(e) => setColumnMap((p) => ({ ...p, [f.key]: e.target.value }))}
                        className="flex-1 px-2 py-1.5 text-xs rounded-lg bg-surface-2 border border-border text-text focus:outline-none"
                      >
                        <option value="">— Ignorar —</option>
                        {csvHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={computePreview}
                    className="w-full py-2 text-xs font-medium bg-surface-2 hover:bg-border rounded-lg text-text transition-colors"
                  >
                    Calcular vista previa
                  </button>
                </div>
              )}

              {/* Preview */}
              {previewValues && (
                <div className="bg-surface-2 border border-border rounded-lg p-3">
                  <p className="text-xs font-semibold text-muted mb-2">Vista previa</p>
                  <div className="grid grid-cols-2 gap-1">
                    {METRIC_FIELDS.map((f) => {
                      const val = previewValues[f.key]
                      if (val === null) return null
                      return (
                        <div key={f.key} className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted">{f.label}</span>
                          <span className="text-xs font-mono text-text">{val.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-danger text-sm bg-danger/10 border border-danger/20 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button" onClick={onClose}
              className="px-4 py-2.5 border border-border text-muted hover:text-text rounded-lg text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-yesica hover:bg-yesica/80 text-bg font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar métricas'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
