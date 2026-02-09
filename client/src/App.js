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

const AppContent = () => {
  const [monitors, setMonitors] = useState([
    {
      id: 1,
      name: "API Principal",
      url: "https://api.example.com",
      type: "HTTP",
      status: "up",
      uptime: 99.8,
      responseTime: 145,
      lastCheck: new Date(),
      interval: 5,
    },
    {
      id: 2,
      name: "Site Web",
      url: "https://www.example.com",
      type: "HTTPS",
      status: "up",
      uptime: 99.95,
      responseTime: 89,
      lastCheck: new Date(),
      interval: 5,
    },
    {
      id: 3,
      name: "Base de données",
      url: "db.example.com:5432",
      type: "PORT",
      status: "down",
      uptime: 98.2,
      responseTime: 0,
      lastCheck: new Date(),
      interval: 5,
    },
    {
      id: 4,
      name: "Serveur Email",
      url: "mail.example.com",
      type: "PING",
      status: "up",
      uptime: 99.99,
      responseTime: 12,
      lastCheck: new Date(),
      interval: 5,
    },
  ]);

  const [activeTab, setActiveTab] = useState("dashboard");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMonitor, setSelectedMonitor] = useState(null);

  const uptimeData = [
    { time: "00:00", uptime: 100, responseTime: 120 },
    { time: "04:00", uptime: 100, responseTime: 135 },
    { time: "08:00", uptime: 99.5, responseTime: 180 },
    { time: "12:00", uptime: 98, responseTime: 250 },
    { time: "16:00", uptime: 99, responseTime: 150 },
    { time: "20:00", uptime: 100, responseTime: 110 },
    { time: "24:00", uptime: 100, responseTime: 125 },
  ];

  const incidents = [
    {
      id: 1,
      monitor: "Base de données",
      type: "Panne",
      duration: "15 min",
      time: "2 heures",
      resolved: false,
    },
    {
      id: 2,
      monitor: "API Principal",
      type: "Ralentissement",
      duration: "5 min",
      time: "6 heures",
      resolved: true,
    },
  ];

  const stats = {
    totalMonitors: monitors.length,
    upMonitors: monitors.filter((m) => m.status === "up").length,
    avgUptime: (
      monitors.reduce((acc, m) => acc + m.uptime, 0) / monitors.length
    ).toFixed(2),
    avgResponseTime: Math.round(
      monitors.reduce((acc, m) => acc + m.responseTime, 0) / monitors.length,
    ),
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
      lastCheck: new Date(),
      interval: parseInt(formData.interval),
    };
    setMonitors([...monitors, newMonitor]);
    setShowAddModal(false);
  };

  const Dashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Moniteurs</p>
              <p className="text-3xl font-bold mt-2">{stats.totalMonitors}</p>
            </div>
            <Server className="w-12 h-12 text-blue-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Services Actifs</p>
              <p className="text-3xl font-bold mt-2 text-green-600">
                {stats.upMonitors}
              </p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Disponibilité Moy.</p>
              <p className="text-3xl font-bold mt-2">{stats.avgUptime}%</p>
            </div>
            <TrendingUp className="w-12 h-12 text-purple-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Temps Réponse Moy.</p>
              <p className="text-3xl font-bold mt-2">
                {stats.avgResponseTime}ms
              </p>
            </div>
            <Zap className="w-12 h-12 text-yellow-500 opacity-20" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 border">
        <h3 className="text-lg font-semibold mb-4">
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

      <div className="bg-white rounded-lg shadow-sm p-6 border">
        <h3 className="text-lg font-semibold mb-4">Temps de Réponse (24h)</h3>
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
    </div>
  );

  const MonitorsView = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Moniteurs Actifs</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un Moniteur
        </button>
      </div>

      <div className="grid gap-4">
        {monitors.map((monitor) => (
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
                    <h3 className="font-semibold text-lg">{monitor.name}</h3>
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {monitor.type}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{monitor.url}</p>
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
                      {monitor.responseTime}ms
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Intervalle</p>
                    <p className="text-lg font-bold">{monitor.interval}min</p>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMonitors(monitors.filter((m) => m.id !== monitor.id));
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
  );

  const IncidentsView = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Historique des Incidents</h2>

      <div className="bg-white rounded-lg shadow-sm border">
        {incidents.map((incident) => (
          <div key={incident.id} className="p-6 border-b last:border-b-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div
                  className={`w-3 h-3 rounded-full ${incident.resolved ? "bg-green-500" : "bg-red-500"}`}
                ></div>
                <div>
                  <h3 className="font-semibold">{incident.monitor}</h3>
                  <p className="text-sm text-gray-600">
                    {incident.type} - Durée: {incident.duration}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Il y a {incident.time}</p>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${incident.resolved ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                >
                  {incident.resolved ? "Résolu" : "En cours"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const StatusPage = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Tous les systèmes opérationnels
            </h1>
            <p className="text-green-100">
              Dernière mise à jour: {new Date().toLocaleString("fr-FR")}
            </p>
          </div>
          <CheckCircle className="w-16 h-16" />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 border">
        <h2 className="text-xl font-bold mb-4">Statut des Services</h2>
        <div className="space-y-3">
          {monitors.map((monitor) => (
            <div
              key={monitor.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                {monitor.status === "up" ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
                <span className="font-medium">{monitor.name}</span>
              </div>
              <span
                className={`text-sm ${monitor.status === "up" ? "text-green-600" : "text-red-600"}`}
              >
                {monitor.status === "up" ? "Opérationnel" : "Panne"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 border">
        <h2 className="text-xl font-bold mb-4">
          Statistiques de Disponibilité (30 jours)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {monitors.map((monitor) => (
            <div
              key={monitor.id}
              className="text-center p-4 bg-gray-50 rounded-lg"
            >
              <p className="text-sm text-gray-600 mb-2">{monitor.name}</p>
              <p className="text-2xl font-bold text-green-600">
                {monitor.uptime}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex space-x-1 mb-6 bg-white rounded-lg p-1 shadow-sm border">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              activeTab === "dashboard"
                ? "bg-blue-600 text-white"
                : "hover:bg-gray-100"
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
                : "hover:bg-gray-100"
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
                : "hover:bg-gray-100"
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
                : "hover:bg-gray-100"
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
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <AppContent />
      </ProtectedRoute>
    </AuthProvider>
  );
};

export default App;
