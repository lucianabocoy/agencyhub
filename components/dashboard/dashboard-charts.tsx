'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts'

interface ClientBar { name: string; horas: number }
interface UserBar { name: string; color: string; horas: number }
interface ActivityBar { name: string; horas: number }

interface Props {
  clientData: ClientBar[]
  userData: UserBar[]
  activityData: ActivityBar[]
}

const TOOLTIP_STYLE = {
  backgroundColor: '#1a1d27',
  border: '1px solid #2d3244',
  borderRadius: '8px',
  color: '#e4e6ee',
  fontSize: 12,
}

export function DashboardCharts({ clientData, userData, activityData }: Props) {
  return (
    <div className="space-y-6">
      {/* Horas por cliente — barras horizontales */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold text-text mb-4">
          Horas por cliente <span className="text-muted font-normal">(últimos 30 días)</span>
        </h2>
        {clientData.length === 0 ? (
          <p className="text-muted text-sm py-8 text-center">Sin datos</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(240, clientData.length * 36)}>
            <BarChart
              data={clientData}
              layout="vertical"
              margin={{ left: 120, right: 60, top: 4, bottom: 4 }}
            >
              <CartesianGrid horizontal={false} stroke="#2d3244" strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fill: '#8b90a5', fontSize: 11 }} axisLine={false} tickLine={false} unit="h" />
              <YAxis
                type="category" dataKey="name" width={115}
                tick={{ fill: '#e4e6ee', fontSize: 12 }} axisLine={false} tickLine={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v: unknown) => [`${v}h`, 'Horas']}
              />
              <Bar dataKey="horas" fill="#818cf8" radius={[0, 4, 4, 0]} maxBarSize={22}>
                <LabelList dataKey="horas" position="right" formatter={(v: unknown) => `${v}h`}
                  style={{ fill: '#8b90a5', fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Horas por responsable */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text mb-4">Horas por responsable</h2>
          {userData.length === 0 ? (
            <p className="text-muted text-sm py-6 text-center">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={userData} margin={{ top: 4, right: 30, bottom: 4, left: 4 }}>
                <CartesianGrid vertical={false} stroke="#2d3244" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fill: '#e4e6ee', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8b90a5', fontSize: 11 }} axisLine={false} tickLine={false} unit="h" />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => [`${v}h`, 'Horas']} />
                <Bar dataKey="horas" radius={[4, 4, 0, 0]} maxBarSize={44}>
                  {userData.map((u, i) => (
                    <Cell key={i} fill={u.color} />
                  ))}
                  <LabelList dataKey="horas" position="top" formatter={(v: unknown) => `${v}h`}
                    style={{ fill: '#8b90a5', fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Distribución por actividad */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text mb-4">Por tipo de actividad</h2>
          {activityData.length === 0 ? (
            <p className="text-muted text-sm py-6 text-center">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={activityData}
                layout="vertical"
                margin={{ left: 140, right: 50, top: 4, bottom: 4 }}
              >
                <CartesianGrid horizontal={false} stroke="#2d3244" strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fill: '#8b90a5', fontSize: 11 }} axisLine={false} tickLine={false} unit="h" />
                <YAxis
                  type="category" dataKey="name" width={135}
                  tick={{ fill: '#e4e6ee', fontSize: 11 }} axisLine={false} tickLine={false}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => [`${v}h`, 'Horas']} />
                <Bar dataKey="horas" fill="#34d399" radius={[0, 4, 4, 0]} maxBarSize={18}>
                  <LabelList dataKey="horas" position="right" formatter={(v: unknown) => `${v}h`}
                    style={{ fill: '#8b90a5', fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
