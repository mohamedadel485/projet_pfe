import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  Server,
  Globe,
  Zap,
  Bell,
  Users,
  Settings,
  Plus,
  Activity,
  Trash,
} from "lucide-react";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Header from "./components/Header";
import AddMonitorModal from "./components/AddMonitorModal";
import PerformanceDashboard from "./components/PerformanceDashboard";

const AppContent = () => {
  const [monitors, setMonitors] = useState([]);

  const [activeTab, setActiveTab] = useState("dashboard");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPerfDashboard, setShowPerfDashboard] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const [selectedMonitor, setSelectedMonitor] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [groupByTag, setGroupByTag] = useState(false);

  const [dashboardWidgets, setDashboardWidgets] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("dashboard_widgets")) || {
          availability: true,
          response: true,
        }
      );
    } catch {
      return { availability: true, response: true };
    }
  });

  useEffect(() => {
    localStorage.setItem("dashboard_widgets", JSON.stringify(dashboardWidgets));
  }, [dashboardWidgets]);

  const uptimeData = [
    { time: "00:00", uptime: 100, responseTime: 120 },
    { time: "04:00", uptime: 100, responseTime: 135 },
    { time: "08:00", uptime: 99.5, responseTime: 180 },
    { time: "12:00", uptime: 98, responseTime: 250 },
    { time: "16:00", uptime: 99, responseTime: 150 },
    { time: "20:00", uptime: 100, responseTime: 110 },
    { time: "24:00", uptime: 100, responseTime: 125 },
  ];

  const [incidents, setIncidents] = useState([]);

  const updateIncident = (id, patch) => {
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === id ? { ...inc, ...patch } : inc)),
    );
  };
  const addIncidentComment = (id, comment) => {
    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === id
          ? { ...inc, comments: [...(inc.comments || []), comment] }
          : inc,
      ),
    );
  };

  const deleteIncidentComment = (incidentId, commentIndex) => {
    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === incidentId
          ? {
              ...inc,
              comments: inc.comments.filter((_, idx) => idx !== commentIndex),
            }
          : inc,
      ),
    );
  };

  const stats = {
    totalMonitors: monitors.length,
    upMonitors: monitors.filter((m) => m.status === "up").length,
    avgUptime: monitors.length
      ? (monitors.reduce((acc, m) => acc + m.uptime, 0) / monitors.length).toFixed(2)
      : "0.00",
    avgResponseTime: monitors.length
      ? Math.round(
          monitors.reduce((acc, m) => acc + (m.responseTime || 0), 0) /
            monitors.length,
        )
      : 0,
  };

  // Add YouTube quick stat for public status (example/static)
  const youtube = {
    name: "YouTube",
    status: "up",
    uptime: 99.9,
    responseTime: 123,
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setMonitors((prev) =>
        prev.map((monitor) => ({
          ...monitor,
          lastCheck: new Date(),
          responseTime:
            monitor.status === "up"
              ? Math.max(50, monitor.responseTime + Math.random() * 20 - 10)
              : 0,
        })),
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status) => {
    return status === "up" ? "text-green-500" : "text-red-500";
  };

  const getStatusBg = (status) => {
    return status === "up" ? "bg-green-50" : "bg-red-50";
  };

  const handleAddMonitor = (formData) => {
    const newMonitor = {
      id: Math.max(...monitors.map((m) => m.id), 0) + 1,
      name: formData.name,
      url: formData.url,
      type: formData.type,
      status: "up",
      uptime: 100,
      responseTime: 0,
      tags: formData.tags || [],
      lastCheck: new Date(),
      interval: parseInt(formData.interval),
    };
    setMonitors([...monitors, newMonitor]);
    setShowAddModal(false);
  };

  const Sparkline = ({ data }) => (
    <div className="w-24 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
        >
          <Line
            type="monotone"
            dataKey="value"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  const Dashboard = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <div className="flex items-center gap-2">
          <label className="text-sm">Widgets:</label>
          <button
            className={`px-2 py-1 rounded ${dashboardWidgets.availability ? "bg-blue-600 text-white" : "bg-gray-100"}`}
            onClick={() =>
              setDashboardWidgets((w) => ({
                ...w,
                availability: !w.availability,
              }))
            }
          >
            Disponibilité
          </button>
          <button
            className={`px-2 py-1 rounded ${dashboardWidgets.response ? "bg-blue-600 text-white" : "bg-gray-100"}`}
            onClick={() =>
              setDashboardWidgets((w) => ({ ...w, response: !w.response }))
            }
          >
            Réponse
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Moniteurs</p>
              <p className="text-3xl font-bold mt-2 text-gray-900 dark:text-white">{stats.totalMonitors}</p>
            </div>
            <Server className="w-12 h-12 text-blue-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Services Actifs</p>
              <p className="text-3xl font-bold mt-2 text-green-600 dark:text-green-400">
                {stats.upMonitors}
              </p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Disponibilité Moy.</p>
              <p className="text-3xl font-bold mt-2 text-gray-900 dark:text-white">{stats.avgUptime}%</p>
            </div>
            <TrendingUp className="w-12 h-12 text-purple-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Temps Réponse Moy.</p>
              <p className="text-3xl font-bold mt-2 text-gray-900 dark:text-white">
                {stats.avgResponseTime}ms
              </p>
            </div>
            <Zap className="w-12 h-12 text-yellow-500 opacity-20" />
          </div>
        </div>
      </div>
      {dashboardWidgets.availability && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Tendances de Disponibilité (24h)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={uptimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="uptime"
                stroke="#10b981"
                fill="#10b98120"
                name="Disponibilité %"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {dashboardWidgets.response && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Temps de Réponse (24h)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={uptimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="responseTime"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Temps de réponse (ms)"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );

  const MonitorsView = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Moniteurs Actifs</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white border rounded-lg px-3 py-1">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher moniteur..."
              className="text-sm px-2 py-1 outline-none"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm ml-2"
            >
              <option value="">Tous</option>
              <option value="up">Opérationnel</option>
              <option value="down">Panne</option>
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-sm ml-2"
            >
              <option value="">Tous types</option>
              <option value="HTTP">HTTP</option>
              <option value="HTTPS">HTTPS</option>
              <option value="PING">PING</option>
              <option value="PORT">PORT</option>
            </select>
            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="text-sm ml-2"
            >
              <option value="">Tous tags</option>
              {[...new Set(monitors.flatMap((m) => m.tags || []))].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <label className="ml-3 text-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={groupByTag}
                onChange={(e) => setGroupByTag(e.target.checked)}
              />{" "}
              Grouper
            </label>
          </div>
          <button
            onClick={() => setShowPerfDashboard(true)}
            className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            Performance
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un Moniteur
          </button>
        </div>
      </div>

      {(() => {
        const filtered = monitors.filter((m) => {
          if (
            searchQuery &&
            !`${m.name} ${m.url}`
              .toLowerCase()
              .includes(searchQuery.toLowerCase())
          )
            return false;
          if (filterStatus && m.status !== filterStatus) return false;
          if (filterType && m.type !== filterType) return false;
          if (filterTag && !(m.tags || []).includes(filterTag)) return false;
          return true;
        });

        if (groupByTag) {
          const grouped = {};
          filtered.forEach((m) => {
            (m.tags || ["ungrouped"]).forEach((t) => {
              grouped[t] = grouped[t] || [];
              grouped[t].push(m);
            });
          });
          return Object.entries(grouped).map(([tag, list]) => (
            <div key={tag} className="space-y-2">
              <h3 className="text-md font-semibold">Tag: {tag}</h3>
              <div className="grid gap-4">
                {list.map((monitor) => (
                  <div
                    key={monitor.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer dark:hover:bg-gray-700"
                    onClick={() => setSelectedMonitor(monitor)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div
                          className={`w-12 h-12 rounded-lg ${getStatusBg(monitor.status)} flex items-center justify-center`}
                        >
                          {monitor.status === "up" ? (
                            <CheckCircle
                              className={`w-6 h-6 ${getStatusColor(monitor.status)}`}
                            />
                          ) : (
                            <AlertCircle
                              className={`w-6 h-6 ${getStatusColor(monitor.status)}`}
                            />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h3 className="font-semibold text-lg">
                              {monitor.name}
                            </h3>
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                              {monitor.type}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {monitor.url}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            {(monitor.tags || []).map((t) => (
                              <span
                                key={t}
                                className="text-xs bg-gray-100 px-2 py-0.5 rounded"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="grid grid-cols-3 gap-8 text-center">
                          <div>
                            <p className="text-xs text-gray-500">
                              Disponibilité
                            </p>
                            <p className="text-lg font-bold text-green-600">
                              {monitor.uptime}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">
                              Temps Réponse
                            </p>
                            <p className="text-lg font-bold">
                              {Math.round(monitor.responseTime)}ms
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Intervalle</p>
                            <p className="text-lg font-bold">
                              {monitor.interval}min
                            </p>
                          </div>
                        </div>
                        <Sparkline
                          data={Array.from({ length: 8 }).map((_, i) => ({
                            value: Math.max(
                              1,
                              Math.round(
                                monitor.responseTime +
                                  (Math.random() * 40 - 20),
                              ),
                            ),
                          }))}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMonitors(
                              monitors.filter((m) => m.id !== monitor.id),
                            );
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                          title="Supprimer ce moniteur"
                        >
                          <Trash className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ));
        }

        return (
          <div className="grid gap-4">
            {filtered.map((monitor) => (
              <div
                key={monitor.id}
                className="bg-white rounded-lg shadow-sm p-6 border hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedMonitor(monitor)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <div
                      className={`w-12 h-12 rounded-lg ${getStatusBg(monitor.status)} flex items-center justify-center`}
                    >
                      {monitor.status === "up" ? (
                        <CheckCircle
                          className={`w-6 h-6 ${getStatusColor(monitor.status)}`}
                        />
                      ) : (
                        <AlertCircle
                          className={`w-6 h-6 ${getStatusColor(monitor.status)}`}
                        />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-semibold text-lg">
                          {monitor.name}
                        </h3>
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                          {monitor.type}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {monitor.url}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        {(monitor.tags || []).map((t) => (
                          <span
                            key={t}
                            className="text-xs bg-gray-100 px-2 py-0.5 rounded"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="grid grid-cols-3 gap-8 text-center">
                      <div>
                        <p className="text-xs text-gray-500">Disponibilité</p>
                        <p className="text-lg font-bold text-green-600">
                          {monitor.uptime}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Temps Réponse</p>
                        <p className="text-lg font-bold">
                          {Math.round(monitor.responseTime)}ms
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Intervalle</p>
                        <p className="text-lg font-bold">
                          {monitor.interval}min
                        </p>
                      </div>
                    </div>

                    <Sparkline
                      data={Array.from({ length: 8 }).map((_, i) => ({
                        value: Math.max(
                          1,
                          Math.round(
                            monitor.responseTime + (Math.random() * 40 - 20),
                          ),
                        ),
                      }))}
                    />

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMonitors(
                          monitors.filter((m) => m.id !== monitor.id),
                        );
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                      title="Supprimer ce moniteur"
                    >
                      <Trash className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );

  const IncidentItem = ({ incident }) => {
    const [draft, setDraft] = useState("");

    return (
      <div className="p-6 border-b last:border-b-0">
        <div className="flex items-start justify-between flex-col md:flex-row">
          <div className="flex items-center space-x-4 flex-1">
            <div className="text-xl mr-2">
              {incident.resolved ? "✅" : "🔴"}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">{incident.monitor}</h3>
              <p className="text-sm text-gray-600">
                {incident.type} - Durée: {incident.duration}
              </p>
              <div className="mt-2 text-sm text-gray-500">
                Il y a {incident.time}
              </div>
              <div className="mt-3">
                <div className="text-sm font-medium">Commentaires:</div>
                <ul className="mt-2 space-y-2">
                  {(incident.comments || []).map((c, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-gray-700 flex items-start justify-between gap-2"
                    >
                      <span>
                        • {c.text}{" "}
                        <span className="text-xs text-gray-400">
                          ({c.by} • {c.time})
                        </span>
                      </span>
                      <button
                        onClick={() => deleteIncidentComment(incident.id, idx)}
                        className="text-red-500 hover:text-red-700 transition flex-shrink-0"
                        title="Supprimer ce commentaire"
                        aria-label="Supprimer"
                      >
                        <Trash size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Ajouter un commentaire"
                    className="border rounded p-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        const text = draft.trim();
                        if (!text) return;
                        addIncidentComment(incident.id, {
                          by: "vous",
                          text,
                          time: new Date().toLocaleTimeString(),
                        });
                        setDraft("");
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                    >
                      Ajouter
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const IncidentsView = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Historique des Incidents</h2>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-auto">
        {incidents.map((incident) => (
          <IncidentItem key={incident.id} incident={incident} />
        ))}
      </div>
    </div>
  );

  const StatusPage = () => (
    <div className="space-y-6">
      {/* Global status indicator */}
      <div
        className={`rounded-lg shadow-lg p-6 text-white ${monitors.some((m) => m.status === "down") ? "bg-red-600" : "bg-green-600"}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1">
              {monitors.some((m) => m.status === "down")
                ? "Problèmes détectés"
                : "Tous les systèmes opérationnels"}{" "}
              {monitors.some((m) => m.status === "down") ? "🔴" : "✅"}
            </h1>
            <p className="text-green-100">
              Dernière mise à jour: {new Date().toLocaleString("fr-FR")}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm">
              Moniteurs: <strong>{stats.totalMonitors}</strong>
            </div>
            <div className="text-sm">
              Actifs: <strong>{stats.upMonitors}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-xl font-bold">Statut des Services</h2>
        <div className="flex items-center gap-3">
          <button
            className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded"
            onClick={() => setShowTechnical((s) => !s)}
          >
            {showTechnical
              ? "Masquer détails techniques"
              : "Afficher détails techniques"}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
        <div className="space-y-3">
          {monitors.map((monitor) => (
            <div
              key={monitor.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg flex-col md:flex-row"
            >
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="text-2xl">
                  {monitor.status === "up"
                    ? "✅"
                    : monitor.status === "down"
                      ? "🔴"
                      : "⚠️"}
                </div>
                <div>
                  <div className="font-medium">{monitor.name}</div>
                  <div className="text-xs text-gray-500">{monitor.type}</div>
                </div>
              </div>
              <div className="text-right mt-3 md:mt-0">
                <div
                  className={`text-sm ${monitor.status === "up" ? "text-green-600" : "text-red-600"}`}
                >
                  {monitor.status === "up" ? "Opérationnel" : "Panne"}
                </div>
                {showTechnical && (
                  <div className="text-xs text-gray-500 mt-2">
                    <div>URL: {monitor.url}</div>
                    <div>
                      Temps réponse: {Math.round(monitor.responseTime)} ms
                    </div>
                    <div>
                      Dernière vérif:{" "}
                      {new Date(monitor.lastCheck).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          Statistiques de Disponibilité (30 jours)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...monitors, youtube].map((monitor, idx) => (
            <div key={idx} className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">{monitor.name}</p>
              <p className="text-2xl font-bold text-green-600">
                {monitor.uptime}%
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 border">
        <h2 className="text-xl font-bold mb-4">
          Historique des incidents (public)
        </h2>
        <div className="space-y-3">
          {incidents.map((incident) => (
            <div key={incident.id} className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">
                    {incident.monitor} — {incident.type}
                  </div>
                  <div className="text-sm text-gray-500">
                    Il y a {incident.time} • Durée: {incident.duration}
                  </div>
                </div>
                <div className="text-sm">
                  {incident.resolved ? "✅ Résolu" : "🔴 En cours"}
                </div>
              </div>
              {incident.comments && incident.comments.length > 0 && (
                <div className="mt-3 text-sm text-gray-700">
                  <div className="font-medium">Commentaires publics:</div>
                  <ul className="mt-2 space-y-1">
                    {incident.comments.map((c, i) => (
                      <li key={i}>
                        • {c.text}{" "}
                        <span className="text-xs text-gray-400">({c.by})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex space-x-1 mb-6 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-sm border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              activeTab === "dashboard"
                ? "bg-blue-600 text-white"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            <div className="flex items-center justify-center">
              <Activity className="w-4 h-4 mr-2" />
              Tableau de Bord
            </div>
          </button>
          <button
            onClick={() => setActiveTab("monitors")}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              activeTab === "monitors"
                ? "bg-blue-600 text-white"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            <div className="flex items-center justify-center">
              <Server className="w-4 h-4 mr-2" />
              Moniteurs
            </div>
          </button>
          <button
            onClick={() => setActiveTab("incidents")}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              activeTab === "incidents"
                ? "bg-blue-600 text-white"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            <div className="flex items-center justify-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              Incidents
            </div>
          </button>
          <button
            onClick={() => setActiveTab("status")}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              activeTab === "status"
                ? "bg-blue-600 text-white"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            <div className="flex items-center justify-center">
              <Globe className="w-4 h-4 mr-2" />
              Page de Statut
            </div>
          </button>
        </div>

        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "monitors" && <MonitorsView />}
        {activeTab === "incidents" && <IncidentsView />}
        {activeTab === "status" && <StatusPage />}
      </div>

      <AddMonitorModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddMonitor}
      />
      <PerformanceDashboard
        isOpen={showPerfDashboard}
        onClose={() => setShowPerfDashboard(false)}
        monitors={monitors}
      />
    </div>
  );
};

const App = () => (
  <AuthProvider>
    <ProtectedRoute>
      <AppContent />
    </ProtectedRoute>
  </AuthProvider>
);

export default App;
