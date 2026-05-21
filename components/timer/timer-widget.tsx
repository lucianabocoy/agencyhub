'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Client, type TimeEntry, ACTIVITY_TYPES } from '@/types/index'
import { formatSeconds, todayAR } from '@/lib/utils'
import { Play, Pause, Square, ChevronDown } from 'lucide-react'

interface TimerWidgetProps {
  userId: string
  assignedClients: Client[]
}

export function TimerWidget({ userId, assignedClients }: TimerWidgetProps) {
  const supabase = createClient()

  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedActivity, setSelectedActivity] = useState('')
  const [customActivity, setCustomActivity] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Escuchar sugerencia de cliente desde la lista de tareas del home
  useEffect(() => {
    function onSuggest(e: Event) {
      const { clientId } = (e as CustomEvent).detail
      if (!activeEntry && clientId) {
        setSelectedClient(clientId)
        setExpanded(true)
      }
    }
    window.addEventListener('timer-suggest', onSuggest)
    return () => window.removeEventListener('timer-suggest', onSuggest)
  }, [activeEntry])

  // Cargar cronómetro activo al montar
  useEffect(() => {
    async function loadActive() {
      const { data } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('is_running', true)
        .single()

      if (data) {
        const entry = data as TimeEntry
        setActiveEntry(entry)
        const secondsSinceStart =
          (Date.now() - new Date(entry.start_time).getTime()) / 1000
        const pausedSeconds = entry.paused_minutes * 60
        setElapsed(Math.max(0, Math.round(secondsSinceStart - pausedSeconds)))
      }
    }
    loadActive()
  }, [userId])

  // Tick del reloj
  useEffect(() => {
    if (activeEntry && activeEntry.is_running && !activeEntry.is_paused) {
      intervalRef.current = setInterval(() => {
        setElapsed((e) => e + 1)
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [activeEntry?.is_running, activeEntry?.is_paused])

  // Inicio automático: cuando cliente + actividad están seleccionados
  const activityValue = selectedActivity === 'Otro' ? customActivity : selectedActivity
  const canStart = selectedClient && activityValue && !activeEntry

  useEffect(() => {
    if (canStart && !loading) {
      startTimer()
    }
  }, [selectedClient, activityValue])

  async function startTimer() {
    if (!selectedClient || !activityValue || activeEntry || loading) return
    setLoading(true)

    const { data, error } = await supabase
      .from('time_entries')
      .insert({
        user_id: userId,
        client_id: selectedClient,
        activity_type: activityValue,
        start_time: new Date().toISOString(),
        is_running: true,
        is_paused: false,
        date: todayAR(),
      })
      .select()
      .single()

    if (!error && data) {
      setActiveEntry(data as TimeEntry)
      setElapsed(0)
      setExpanded(false)
    }
    setLoading(false)
  }

  async function pauseResume() {
    if (!activeEntry) return

    if (activeEntry.is_paused) {
      // Reanudar
      const pausedMinutes =
        activeEntry.paused_minutes +
        (Date.now() - new Date(activeEntry.last_paused_at!).getTime()) / 60000

      const { data } = await supabase
        .from('time_entries')
        .update({ is_paused: false, paused_minutes: pausedMinutes })
        .eq('id', activeEntry.id)
        .select()
        .single()

      if (data) setActiveEntry(data as TimeEntry)
    } else {
      // Pausar
      const { data } = await supabase
        .from('time_entries')
        .update({ is_paused: true, last_paused_at: new Date().toISOString() })
        .eq('id', activeEntry.id)
        .select()
        .single()

      if (data) setActiveEntry(data as TimeEntry)
    }
  }

  async function stopTimer() {
    if (!activeEntry) return

    const endTime = new Date().toISOString()
    let pausedMinutes = activeEntry.paused_minutes
    if (activeEntry.is_paused && activeEntry.last_paused_at) {
      pausedMinutes += (Date.now() - new Date(activeEntry.last_paused_at).getTime()) / 60000
    }
    const totalSeconds = (Date.now() - new Date(activeEntry.start_time).getTime()) / 1000
    const durationMinutes = Math.max(0, totalSeconds / 60 - pausedMinutes)

    await supabase
      .from('time_entries')
      .update({
        end_time: endTime,
        is_running: false,
        is_paused: false,
        duration_minutes: durationMinutes,
        paused_minutes: pausedMinutes,
      })
      .eq('id', activeEntry.id)

    setActiveEntry(null)
    setElapsed(0)
    setSelectedClient('')
    setSelectedActivity('')
    setCustomActivity('')
  }

  const clientName = assignedClients.find((c) => c.id === selectedClient)?.name ?? ''

  return (
    <div data-timer-widget className="bg-surface border-b border-border px-4 py-2 flex items-center gap-4">
      {activeEntry ? (
        // Estado: cronómetro corriendo
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${activeEntry.is_paused ? 'bg-warning' : 'bg-success animate-pulse'}`}
            />
            <span className="font-mono text-sm text-text font-bold">{formatSeconds(elapsed)}</span>
          </div>

          <div className="text-sm text-muted">
            <span className="text-text font-medium">{clientName}</span>
            <span className="mx-1.5">·</span>
            <span>{activeEntry.activity_type}</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={pauseResume}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 hover:bg-border rounded-lg text-xs font-medium text-muted hover:text-text transition-colors"
            >
              {activeEntry.is_paused ? (
                <><Play size={12} /> Reanudar</>
              ) : (
                <><Pause size={12} /> Pausar</>
              )}
            </button>
            <button
              onClick={stopTimer}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-danger/20 hover:bg-danger/30 rounded-lg text-xs font-medium text-danger transition-colors"
            >
              <Square size={12} /> Finalizar
            </button>
          </div>
        </div>
      ) : (
        // Estado: sin cronómetro
        <div className="flex items-center gap-3 flex-1">
          <div className="w-2 h-2 rounded-full bg-border" />
          <span className="text-muted text-sm">Sin bloque activo</span>

          <button
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-yesica/15 hover:bg-yesica/25 text-yesica rounded-lg text-xs font-medium transition-colors"
          >
            Iniciar bloque <ChevronDown size={12} className={expanded ? 'rotate-180' : ''} />
          </button>
        </div>
      )}

      {/* Panel de selección */}
      {expanded && !activeEntry && (
        <div className="absolute top-[52px] right-4 z-40 bg-surface border border-border rounded-xl shadow-xl p-4 w-72 space-y-3">
          <p className="text-sm font-semibold text-text">Nuevo bloque de tiempo</p>

          <div>
            <label className="text-xs text-muted mb-1 block">Cliente</label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg"
            >
              <option value="">— Seleccionar —</option>
              {assignedClients.filter((c) => c.status === 'activo').map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted mb-1 block">Actividad</label>
            <select
              value={selectedActivity}
              onChange={(e) => setSelectedActivity(e.target.value)}
              disabled={!selectedClient}
              className="w-full px-3 py-2 text-sm rounded-lg disabled:opacity-50"
            >
              <option value="">— Seleccionar —</option>
              {ACTIVITY_TYPES.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            {selectedActivity === 'Otro' && (
              <input
                type="text"
                value={customActivity}
                onChange={(e) => setCustomActivity(e.target.value)}
                placeholder="Describí la actividad..."
                className="w-full px-3 py-2 text-sm rounded-lg mt-2"
              />
            )}
          </div>

          <p className="text-xs text-muted/70 italic">
            El cronómetro arranca automáticamente al seleccionar cliente + actividad.
          </p>
        </div>
      )}
    </div>
  )
}
