import React, { useState } from "react";

const AddMonitorModal = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    name: "",
    type: "HTTP",
    url: "",
    interval: "1",
    email: false,
    sms: false,
    slack: false,
    discord: false,
  });

  const handleClose = () => {
    setFormData({
      name: "",
      type: "HTTP",
      url: "",
      interval: "1",
      email: false,
      sms: false,
      slack: false,
      discord: false,
    });
    onClose();
  };

  const handleAdd = async () => {
    const ok = await onAdd(formData);
    if (!ok) return;
    setFormData({
      name: "",
      type: "HTTP",
      url: "",
      interval: "1",
      email: false,
      sms: false,
      slack: false,
      discord: false,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 pointer-events-none">
      <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto pointer-events-auto">
        <h2 className="text-2xl font-bold mb-6">Ajouter un Moniteur</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Nom du Moniteur
            </label>
            <input
              type="text"
              className="w-full border rounded-lg px-4 py-2"
              placeholder="Mon API"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Type de Surveillance
            </label>
            <select
              className="w-full border rounded-lg px-4 py-2"
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value })
              }
            >
              <option value="HTTP">HTTP(S)</option>
              <option value="PING">Ping</option>
              <option value="PORT">Port TCP</option>
              <option value="KEYWORD">Mot-clé</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              URL ou Adresse
            </label>
            <input
              type="text"
              className="w-full border rounded-lg px-4 py-2"
              placeholder="https://votre-site.tld"
              value={formData.url}
              onChange={(e) =>
                setFormData({ ...formData, url: e.target.value })
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Intervalle de Vérification (minutes)
            </label>
            <select
              className="w-full border rounded-lg px-4 py-2"
              value={formData.interval}
              onChange={(e) =>
                setFormData({ ...formData, interval: e.target.value })
              }
            >
              <option>1</option>
              <option>5</option>
              <option>10</option>
              <option>30</option>
              <option>60</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Méthode d'Alerte
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.checked })
                  }
                />
                Email
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={formData.sms}
                  onChange={(e) =>
                    setFormData({ ...formData, sms: e.target.checked })
                  }
                />
                SMS
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={formData.slack}
                  onChange={(e) =>
                    setFormData({ ...formData, slack: e.target.checked })
                  }
                />
                Slack
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={formData.discord}
                  onChange={(e) =>
                    setFormData({ ...formData, discord: e.target.checked })
                  }
                />
                Discord
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-4 mt-6">
            <button
              onClick={handleClose}
              className="px-6 py-2 border rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleAdd}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Créer le Moniteur
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddMonitorModal;
