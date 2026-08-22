'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { type ClientBillingHistoryEntry, type FeeCurrency } from '@/types/index'

const PAYMENT_ACCOUNT_SUGGESTIONS = ['Luciana ARS', 'Luciana USD', 'Bruno USD', 'Financiera', 'Efectivo en mano']

interface ClientOption {
  id: string
  name: string
  defaultCurrency: FeeCurrency | null
  defaultPaymentAccount: string | null
}

interface Props {
  clients: ClientOption[]
  history: ClientBillingHistoryEntry[]
  onSaved: (entry: ClientBillingHistoryEntry) => void
  month: string
  onMonthChange: (month: string) => void
}

export function currentMonthStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function shiftMonth(monthStr: string, delta: number) {
  const [y, m] = monthStr.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function monthLabel(monthStr: string) {
  const [y, m] = monthStr.split('-').map(Number)
  const label = new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function formatAmount(amount: number, currency: string) {
  const formatted = amount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return `${currency === 'USD' ? 'US$' : '$'} ${formatted}`
}

export function FacturacionMensual({ clients, history, onSaved, month, onMonthChange }: Props) {
  const entryByClient = useMemo(() => {
    const map = new Map<string, ClientBillingHistoryEntry>()
    for (const h of history) {
      if (h.month === month) map.set(h.client_id, h)
    }
    return map
  }, [history, month])

  const monthTotals = useMemo(() => {
    const byCurrency: Record<string, number> = {}
    for (const h of history) {
      if (h.month !== month || !h.amount || !h.currency) continue
      byCurrency[h.currency] = (byCurrency[h.currency] ?? 0) + h.amount
    }
    return byCurrency
  }, [history, month])

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-text">Facturación por mes</h2>
        <p className="text-muted text-xs mt-0.5">Cargá lo facturado a cada cliente este mes. Se va sumando para el LTV.</p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-surface border border-border rounded-lg px-2 py-1.5">
          <button onClick={() => onMonthChange(shiftMonth(month, -1))} className="text-muted hover:text-text transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-text w-36 text-center capitalize">{monthLabel(month)}</span>
          <button onClick={() => onMonthChange(shiftMonth(month, 1))} className="text-muted hover:text-text transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex items-center gap-3 text-sm">
          {Object.keys(monthTotals).length === 0 ? (
            <span className="text-muted text-xs">Sin carga este mes</span>
          ) : (
            Object.entries(monthTotals).map(([cur, amt]) => (
              <span key={cur} className="text-yesica font-semibold">{formatAmount(amt, cur)}</span>
            ))
          )}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="divide-y divide-border">
          {clients.map((c) => (
            <MonthlyRow
              key={c.id}
              client={c}
              month={month}
              entry={entryByClient.get(c.id) ?? null}
              onSaved={onSaved}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function MonthlyRow({
  client,
  month,
  entry,
  onSaved,
}: {
  client: ClientOption
  month: string
  entry: ClientBillingHistoryEntry | null
  onSaved: (entry: ClientBillingHistoryEntry) => void
}) {
  const [amount, setAmount] = useState(entry?.amount?.toString() ?? '')
  const [currency, setCurrency] = useState<FeeCurrency>(entry?.currency ?? client.defaultCurrency ?? 'ARS')
  const [paymentAccount, setPaymentAccount] = useState(entry?.payment_account ?? client.defaultPaymentAccount ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)

    const res = await fetch('/api/administracion/billing-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: client.id,
        month,
        amount: amount === '' ? null : Number(amount),
        currency,
        payment_account: paymentAccount || null,
      }),
    })

    setSaving(false)
    if (!res.ok) {
      const json = await res.json().catch(() => null)
      setError(json?.error ?? 'No se pudo guardar')
      return
    }

    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
    onSaved({
      client_id: client.id,
      month,
      amount: amount === '' ? null : Number(amount),
      currency,
      payment_account: paymentAccount || null,
      updated_at: new Date().toISOString(),
    })
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <p className="flex-1 min-w-0 text-sm text-text truncate">{client.name}</p>
      {error && <p className="text-danger text-xs flex-shrink-0">{error}</p>}
      <input
        type="number"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0"
        className="w-28 px-2.5 py-1.5 text-sm rounded-lg"
      />
      <select value={currency} onChange={(e) => setCurrency(e.target.value as FeeCurrency)} className="px-2 py-1.5 text-sm rounded-lg">
        <option value="ARS">ARS</option>
        <option value="USD">USD</option>
      </select>
      <input
        type="text"
        list="payment-account-suggestions-mensual"
        value={paymentAccount}
        onChange={(e) => setPaymentAccount(e.target.value)}
        placeholder="Cuenta que recibió el pago"
        className="w-40 px-2.5 py-1.5 text-sm rounded-lg"
      />
      <datalist id="payment-account-suggestions-mensual">
        {PAYMENT_ACCOUNT_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
      </datalist>
      <button
        onClick={handleSave}
        disabled={saving}
        className="p-2 rounded-lg text-muted hover:text-yesica transition-colors disabled:opacity-50"
        title="Guardar"
      >
        <Check size={16} className={saved ? 'text-success' : ''} />
      </button>
    </div>
  )
}
