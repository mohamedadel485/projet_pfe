import React, { useMemo, useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { Trash, Download, AlertCircle } from "lucide-react";

// Utility: export CSV
const exportCSV = (filename, rows) => {
  const keys = Object.keys(rows[0] || {});
  const csv = [
    keys.join(","),
    ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const periodOptions = [
  { key: "1h", label: "1 heure" },
  { key: "24h", label: "24 heures" },
  { key: "7d", label: "7 jours" },
  { key: "30d", label: "30 jours" },
];

const generateMockSeries = (periodKey) => {
  // returns array of points { time, availability, responseTime }
  const points = [];
  let count = 24;
  if (periodKey === "1h") count = 12;
  if (periodKey === "24h") count = 24;
  if (periodKey === "7d") count = 7;
  if (periodKey === "30d") count = 30;

  for (let i = 0; i < count; i++) {
    points.push({
      time:
        periodKey === "1h"
          ? `${i * 5}m`
          : periodKey === "24h"
            ? `${i}:00`
            : `${i}`,
      availability: +(95 + Math.random() * 5).toFixed(2),
      responseTime: Math.round(30 + Math.random() * 300),
    });
  }
  return points;
};

const PeriodSelector = ({ value, onChange }) => (
  <div className="flex items-center gap-2">
    {periodOptions.map((p) => (
      <button
        key={p.key}
        onClick={() => onChange(p.key)}
        className={`px-3 py-1 rounded ${value === p.key ? "bg-blue-600 text-white" : "bg-gray-100"}`}
      >
        {p.label}
      </button>
    ))}
  </div>
);

const InteractiveCharts = ({ data }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div className="bg-white rounded p-4 border">
      <h3 className="font-semibold mb-2">Disponibilité</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart
          data={data}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          <defs>
            <linearGradient id="colorAvail" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis domain={[90, 100]} />
          <Tooltip />
          <Area
            type="monotone"
            dataKey="availability"
            stroke="#10b981"
            fillOpacity={1}
            fill="url(#colorAvail)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>

    <div className="bg-white rounded p-4 border">
      <h3 className="font-semibold mb-2">Temps de réponse (ms)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="responseTime"
            stroke="#3b82f6"
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const PerformanceTable = ({ monitors }) => {
  // compute mock 24h/7d/30d availability and avg response time
  const rows = monitors.map((m) => ({
    id: m.id,
    name: m.name,
    status: m.status,
    availability24h: `${(95 + Math.random() * 5).toFixed(2)}%`,
    availability7d: `${(96 + Math.random() * 3).toFixed(2)}%`,
    availability30d: `${(97 + Math.random() * 2).toFixed(2)}%`,
    avgResponse: `${Math.round(30 + Math.random() * 200)} ms`,
    lastIncident: Math.random() > 0.8 ? "Il y a 2 heures" : "—",
  }));

  return (
    <div className="bg-white rounded p-4 border mt-4 overflow-auto">
      <h3 className="font-semibold mb-3">Récapitulatif des Performances</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-600">
            <th className="py-2">Nom</th>
            <th>Statut</th>
            <th>Disponibilité (24h)</th>
            <th>Disponibilité (7j)</th>
            <th>Disponibilité (30j)</th>
            <th>Temps Réponse</th>
            <th>Dernier Incident</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="py-2">{r.name}</td>
              <td>
                {r.status === "up" ? (
                  <span className="text-green-600">Up</span>
                ) : (
                  <span className="text-red-600">Down</span>
                )}
              </td>
              <td>{r.availability24h}</td>
              <td>{r.availability7d}</td>
              <td>{r.availability30d}</td>
              <td>{r.avgResponse}</td>
              <td>{r.lastIncident}</td>
              <td>
                <button className="p-2 text-red-600 hover:bg-red-50 rounded">
                  <Trash className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const AlertsPanel = ({ recentAlerts }) => (
  <div className="bg-white rounded p-4 border mt-4">
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-semibold">Alertes récentes</h3>
      <button className="px-2 py-1 text-sm bg-gray-100 rounded">
        Voir tout
      </button>
    </div>
    {recentAlerts.length === 0 ? (
      <p className="text-sm text-gray-500">Aucune alerte récente</p>
    ) : (
      <ul className="space-y-2">
        {recentAlerts.map((a, i) => (
          <li key={i} className="flex items-start gap-3">
            <AlertCircle className="text-red-600" />
            <div>
              <div className="text-sm font-medium">{a.title}</div>
              <div className="text-xs text-gray-500">
                {a.time} • {a.channel}
              </div>
            </div>
          </li>
        ))}
      </ul>
    )}
  </div>
);

const ThresholdsConfig = ({ onSave }) => {
  const [thresholds, setThresholds] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("thresholds")) || { responseTime: 200 }
      );
    } catch {
      return { responseTime: 200 };
    }
  });

  useEffect(() => {
    localStorage.setItem("thresholds", JSON.stringify(thresholds));
  }, [thresholds]);

  return (
    <div className="bg-white rounded p-4 border mt-4">
      <h3 className="font-semibold mb-2">Seuils d'alerte</h3>
      <div className="flex items-center gap-3">
        <label className="text-sm">Temps de réponse &gt; </label>
        <input
          type="number"
          className="border rounded px-2 py-1 w-24"
          value={thresholds.responseTime}
          onChange={(e) =>
            setThresholds({
              ...thresholds,
              responseTime: Number(e.target.value),
            })
          }
        />
        <span>ms</span>
        <button
          className="ml-4 px-3 py-1 bg-blue-600 text-white rounded"
          onClick={() => onSave && onSave(thresholds)}
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
};

const GeoStatusMap = ({ monitors }) => (
  <div className="bg-white rounded p-4 border mt-4">
    <h3 className="font-semibold mb-2">Carte de statut (placeholder)</h3>
    <div className="h-40 flex items-center justify-center text-gray-500">
      Carte géographique (à implémenter)
    </div>
  </div>
);

const CheckLogs = ({ logs }) => (
  <div className="bg-white rounded p-4 border mt-4 overflow-auto max-h-64">
    <h3 className="font-semibold mb-2">Logs des vérifications</h3>
    <table className="w-full text-sm">
      <thead className="text-gray-600 text-left">
        <tr>
          <th className="py-1">Timestamp</th>
          <th>Monitor</th>
          <th>Statut</th>
          <th>Resp. Time</th>
        </tr>
      </thead>
      <tbody>
        {logs.map((l, i) => (
          <tr key={i} className="border-t">
            <td className="py-1">{l.time}</td>
            <td>{l.monitor}</td>
            <td>{l.status}</td>
            <td>{l.responseTime} ms</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const IncidentCalendar = ({ incidents }) => (
  <div className="bg-white rounded p-4 border mt-4">
    <h3 className="font-semibold mb-2">Calendrier des incidents (timeline)</h3>
    <div className="h-32 flex items-center text-sm text-gray-600">
      Placeholder timeline: {incidents.length} incidents
    </div>
  </div>
);

const ExportButtons = ({ data }) => (
  <div className="flex gap-2">
    <button
      className="px-3 py-1 bg-gray-100 rounded flex items-center gap-2"
      onClick={() => exportCSV("monitors.csv", data)}
    >
      <Download className="w-4 h-4" /> Export CSV
    </button>
  </div>
);

const PerformanceDashboard = ({ isOpen, onClose, onAdd, monitors = [] }) => {
  const [period, setPeriod] = useState("24h");
  const [series, setSeries] = useState(() => generateMockSeries("24h"));
  const [alerts] = useState([]);
  const [logs] = useState(() =>
    Array.from({ length: 20 }).map((_, i) => ({
      time: new Date().toLocaleString(),
      monitor: monitors[i % monitors.length]?.name || `Mon ${i}`,
      status: Math.random() > 0.9 ? "down" : "up",
      responseTime: Math.round(Math.random() * 300),
    })),
  );
  const [incidents] = useState(() => []);

  useEffect(() => {
    setSeries(generateMockSeries(period));
  }, [period]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-start justify-center p-6 overflow-auto bg-black bg-opacity-40">
      <div className="bg-white rounded-lg w-full max-w-5xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Performance Dashboard</h2>
          <div className="flex items-center gap-3">
            <PeriodSelector value={period} onChange={setPeriod} />
            <ExportButtons data={monitors} />
            <button className="px-3 py-1 bg-gray-100 rounded" onClick={onClose}>
              Fermer
            </button>
          </div>
        </div>

        <InteractiveCharts data={series} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          <div className="lg:col-span-2">
            <PerformanceTable monitors={monitors} />
            <CheckLogs logs={logs} />
          </div>
          <div>
            <AlertsPanel recentAlerts={alerts} />
            <ThresholdsConfig
              onSave={(t) => console.log("thresholds saved", t)}
            />
            <GeoStatusMap monitors={monitors} />
          </div>
        </div>

        <IncidentCalendar incidents={incidents} />
      </div>
    </div>
  );
};

export default PerformanceDashboard;
