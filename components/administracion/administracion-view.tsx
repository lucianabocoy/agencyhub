'use client'

import { useMemo, useState } from 'react'
import { Pencil, X, FileText } from 'lucide-react'
import { type ClientBilling, type ClientBillingHistoryEntry, type ClientStatus, type FeeCurrency, type User } from '@/types/index'
import { FacturacionMensual, currentMonthStr, monthLabel } from './facturacion-mensual'

export interface ClientRow {
  id: string
  name: string
  status: ClientStatus
  responsables: Pick<User, 'id' | 'name' | 'color'>[]
  billing: ClientBilling | null
}

const AGENCIA_CLIENT_ID = '1881f6c4-c635-44a6-8032-a4930ced612c'

const STATUS_LABEL: Record<ClientStatus, string> = { activo: 'Activo', pausado: 'Pausado', baja: 'Baja' }
const STATUS_DOT: Record<ClientStatus, string> = { activo: 'bg-success', pausado: 'bg-warning', baja: 'bg-danger' }

const PAYMENT_ACCOUNT_SUGGESTIONS = ['Luciana ARS', 'Luciana USD', 'Bruno USD', 'Financiera', 'Efectivo en mano']

function formatFee(fee: number | null, currency: FeeCurrency | null) {
  if (fee === null || fee === undefined) return '—'
  const formatted = fee.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return `${currency === 'USD' ? 'US$' : '$'} ${formatted}`
}

export function AdministracionView({ rows, history }: { rows: ClientRow[]; history: ClientBillingHistoryEntry[] }) {
  const [list, setList] = useState(rows)
  const [billingHistory, setBillingHistory] = useState(history)
  const [statusFilter, setStatusFilter] = useState<'todos' | ClientStatus>('activo')
  const [editing, setEditing] = useState<ClientRow | null>(null)
  const [month, setMonth] = useState(currentMonthStr())

  const filtered = statusFilter === 'todos' ? list : list.filter((r) => r.status === statusFilter)

  const activeClientCount = useMemo(
    () => list.filter((r) => r.status === 'activo' && r.id !== AGENCIA_CLIENT_ID).length,
    [list]
  )

  // Totalidad facturada del mes seleccionado (lo cargado en "Facturación por mes"), no el honorario fijo.
  const totals = useMemo(() => {
    const byCurrency: Record<string, number> = {}
    for (const h of billingHistory) {
      if (h.month !== month || !h.amount || !h.currency) continue
      byCurrency[h.currency] = (byCurrency[h.currency] ?? 0) + h.amount
    }
    return byCurrency
  }, [billingHistory, month])

  // Desglose por cuenta de cobro del mes seleccionado (lo cargado en "Facturación por mes").
  const byAccount = useMemo(() => {
    const map = new Map<string, { total: number; currency: string; count: number }>()
    for (const h of billingHistory) {
      if (h.month !== month || !h.amount || !h.payment_account) continue
      const key = h.payment_account
      const prev = map.get(key) ?? { total: 0, currency: h.currency ?? '', count: 0 }
      prev.total += h.amount
      prev.count += 1
      map.set(key, prev)
    }
    return Array.from(map.entries())
  }, [billingHistory, month])

  const ltvByClient = useMemo(() => {
    const map = new Map<string, Record<string, number>>()
    for (const h of billingHistory) {
      if (!h.amount || !h.currency) continue
      const byCurrency = map.get(h.client_id) ?? {}
      byCurrency[h.currency] = (byCurrency[h.currency] ?? 0) + h.amount
      map.set(h.client_id, byCurrency)
    }
    return map
  }, [billingHistory])

  function formatLTV(clientId: string) {
    const byCurrency = ltvByClient.get(clientId)
    if (!byCurrency) return '—'
    const parts = Object.entries(byCurrency).map(([cur, amt]) => formatFee(amt, cur as FeeCurrency))
    return parts.length ? parts.join(' · ') : '—'
  }

  function handleSaved(clientId: string, billing: ClientBilling) {
    setList((prev) => prev.map((r) => (r.id === clientId ? { ...r, billing } : r)))
    setEditing(null)
  }

  function handleHistorySaved(entry: ClientBillingHistoryEntry) {
    setBillingHistory((prev) => {
      const idx = prev.findIndex((h) => h.client_id === entry.client_id && h.month === entry.month)
      if (idx === -1) return [...prev, entry]
      const next = [...prev]
      next[idx] = entry
      return next
    })
  }

  const monthlyClients = useMemo(
    () =>
      list
        .filter((r) => r.status === 'activo' && r.id !== AGENCIA_CLIENT_ID)
        .map((r) => ({
          id: r.id,
          name: r.name,
          defaultCurrency: r.billing?.fee_currency ?? null,
          defaultPaymentAccount: r.billing?.payment_account ?? null,
        })),
    [list]
  )

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-text">Administración</h1>
        <p className="text-muted text-sm mt-0.5">Honorarios, facturación y datos fiscales de cada cliente.</p>
      </div>

      {/* Resumen principal: clientes activos y cuánto se factura */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-yesica/10 border border-yesica/30 rounded-xl p-4">
          <p className="text-xs text-yesica/70 mb-1">Clientes activos</p>
          <p className="text-2xl font-bold text-yesica">{activeClientCount}</p>
        </div>
        <div className="bg-yesica/10 border border-yesica/30 rounded-xl p-4">
          <p className="text-xs text-yesica/70 mb-1">Facturado en USD · {monthLabel(month)}</p>
          <p className="text-2xl font-bold text-yesica">{formatFee(totals.USD ?? 0, 'USD')}</p>
        </div>
        <div className="bg-yesica/10 border border-yesica/30 rounded-xl p-4">
          <p className="text-xs text-yesica/70 mb-1">Facturado en ARS · {monthLabel(month)}</p>
          <p className="text-2xl font-bold text-yesica">{formatFee(totals.ARS ?? 0, 'ARS')}</p>
        </div>
      </div>

      {/* Desglose por cuenta de cobro del mes seleccionado */}
      {byAccount.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {byAccount.map(([account, v]) => (
            <div key={account} className="bg-surface border border-border rounded-xl p-3">
              <p className="text-xs text-muted mb-1">{account} · {v.count} {v.count === 1 ? 'cliente' : 'clientes'}</p>
              <p className="text-lg font-bold text-text">{formatFee(v.total, v.currency as FeeCurrency)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtro de estado */}
      <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5 w-fit">
        {(['activo', 'pausado', 'baja', 'todos'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
              statusFilter === s ? 'bg-yesica/20 text-yesica' : 'text-muted hover:text-text'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-surface border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-border text-xs text-muted text-left">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Responsable</th>
              <th className="px-4 py-3 font-medium">Honorarios</th>
              <th className="px-4 py-3 font-medium">LTV</th>
              <th className="px-4 py-3 font-medium">Actualizado</th>
              <th className="px-4 py-3 font-medium">Cuenta de pago</th>
              <th className="px-4 py-3 font-medium">Factura</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-surface-2 transition-colors">
                <td className="px-4 py-3 text-text font-medium whitespace-nowrap">{r.name}</td>
                <td className="px-4 py-3">
                  {r.responsables.length === 0 ? (
                    <span className="text-muted text-xs">—</span>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {r.responsables.map((u) => (
                        <span key={u.id} className="flex items-center gap-1 text-xs text-text">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: u.color ?? '#818cf8' }} />
                          {u.name}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-text whitespace-nowrap">{formatFee(r.billing?.fee ?? null, r.billing?.fee_currency ?? null)}</td>
                <td className="px-4 py-3 text-text whitespace-nowrap">{formatLTV(r.id)}</td>
                <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">{r.billing?.fee_updated_at ?? '—'}</td>
                <td className="px-4 py-3 text-text whitespace-nowrap">{r.billing?.payment_account || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${r.billing?.needs_invoice ? 'bg-info/15 text-info' : 'bg-surface-2 text-muted'}`}>
                    {r.billing?.needs_invoice ? 'Sí' : 'No'}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[r.status]}`} />
                    {STATUS_LABEL[r.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => setEditing(r)} className="text-muted hover:text-text transition-colors">
                    <Pencil size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FacturacionMensual
        clients={monthlyClients}
        history={billingHistory}
        onSaved={handleHistorySaved}
        month={month}
        onMonthChange={setMonth}
      />

      {editing && (
        <EditBillingModal row={editing} onClose={() => setEditing(null)} onSaved={(b) => handleSaved(editing.id, b)} />
      )}
    </div>
  )
}

function EditBillingModal({
  row,
  onClose,
  onSaved,
}: {
  row: ClientRow
  onClose: () => void
  onSaved: (billing: ClientBilling) => void
}) {
  const b = row.billing
  const [fee, setFee] = useState(b?.fee?.toString() ?? '')
  const [feeCurrency, setFeeCurrency] = useState<FeeCurrency>(b?.fee_currency ?? 'ARS')
  const [feeUpdatedAt, setFeeUpdatedAt] = useState(b?.fee_updated_at ?? new Date().toISOString().slice(0, 10))
  const [paymentAccount, setPaymentAccount] = useState(b?.payment_account ?? '')
  const [needsInvoice, setNeedsInvoice] = useState(b?.needs_invoice ?? false)
  const [fiscalData, setFiscalData] = useState(b?.fiscal_data ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/administracion/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fee: fee === '' ? null : Number(fee),
        fee_currency: feeCurrency,
        fee_updated_at: feeUpdatedAt || null,
        payment_account: paymentAccount || null,
        needs_invoice: needsInvoice,
        fiscal_data: fiscalData || null,
      }),
    })
    const json = await res.json()

    if (!res.ok) {
      setError(json.error ?? 'No se pudieron guardar los cambios.')
      setLoading(false)
      return
    }

    setLoading(false)
    onSaved({
      client_id: row.id,
      fee: fee === '' ? null : Number(fee),
      fee_currency: feeCurrency,
      fee_updated_at: feeUpdatedAt || null,
      payment_account: paymentAccount || null,
      needs_invoice: needsInvoice,
      fiscal_data: fiscalData || null,
      updated_at: new Date().toISOString(),
    })
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm rounded-lg'
  const labelCls = 'block text-xs font-medium text-muted mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text">{row.name}</h2>
          <button onClick={onClose} className="text-muted hover:text-text">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Honorarios</label>
              <input type="number" step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Moneda</label>
              <select value={feeCurrency} onChange={(e) => setFeeCurrency(e.target.value as FeeCurrency)} className={inputCls}>
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Actualización de honorarios</label>
            <input type="date" value={feeUpdatedAt} onChange={(e) => setFeeUpdatedAt(e.target.value)} className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Cuenta a la que paga</label>
            <input
              type="text"
              list="payment-account-suggestions"
              value={paymentAccount}
              onChange={(e) => setPaymentAccount(e.target.value)}
              placeholder="Ej: Luciana USD"
              className={inputCls}
            />
            <datalist id="payment-account-suggestions">
              {PAYMENT_ACCOUNT_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>

          <div>
            <label className={labelCls}>¿Necesita factura?</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNeedsInvoice(true)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${needsInvoice ? 'bg-info/15 border-info/40 text-info' : 'border-border text-muted'}`}
              >
                Sí
              </button>
              <button
                type="button"
                onClick={() => setNeedsInvoice(false)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${!needsInvoice ? 'bg-surface-2 border-border text-text' : 'border-border text-muted'}`}
              >
                No
              </button>
            </div>
          </div>

          <div>
            <label className={labelCls}>
              <span className="flex items-center gap-1.5"><FileText size={13} /> Datos fiscales</span>
            </label>
            <textarea
              value={fiscalData}
              onChange={(e) => setFiscalData(e.target.value)}
              rows={3}
              placeholder="Razón social, CUIT, domicilio fiscal..."
              className={`${inputCls} resize-none`}
            />
          </div>

          {error && (
            <p className="text-danger text-sm bg-danger/10 border border-danger/20 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-border text-muted hover:text-text transition-colors">
              Cancelar
            </button>
            <button type="button" onClick={handleSave} disabled={loading} className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg bg-yesica text-bg hover:opacity-90 transition-opacity disabled:opacity-50">
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
