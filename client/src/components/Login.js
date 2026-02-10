import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { AlertCircle, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";

const GOOGLE_CLIENT_ID =
  process.env.REACT_APP_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID";

const Login = ({ onLoginSuccess }) => {
  const { login, register, loginWithGoogle } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isLogin) {
        const result = await login(formData.email, formData.password);
        if (result.success) {
          onLoginSuccess?.();
        } else {
          setError(result.error);
        }
      } else {
        // Inscription avec name, email et password
        const result = await register(
          formData.email,
          formData.password,
          formData.name,
        );
        if (result.success) {
          onLoginSuccess?.();
        } else {
          setError(result.error);
        }
      }
    } catch (err) {
      setError("Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError("");

    try {
      const result = await loginWithGoogle(credentialResponse.credential);
      if (result.success) {
        onLoginSuccess?.();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Erreur lors de la connexion Google");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError("Erreur lors de la connexion Google");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">UptimeWarden</h1>
          <p className="text-blue-100">
            Surveillance de disponibilité web en temps réel
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-lg shadow-2xl p-8 relative z-50 pointer-events-auto">
          {/* Tabs */}
          <div className="flex gap-4 mb-8 border-b border-gray-200">
            <button
              onClick={() => {
                setIsLogin(true);
                setError("");
                setFormData({ email: "", password: "", name: "" });
              }}
              className={`pb-4 px-4 font-semibold transition-colors ${
                isLogin
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Connexion
            </button>
            <button
              onClick={() => {
                setIsLogin(false);
                setError("");
                setFormData({ email: "", password: "", name: "" });
              }}
              className={`pb-4 px-4 font-semibold transition-colors ${
                !isLogin
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Inscription
            </button>
          </div>

          {/* Erreur */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  <User className="w-4 h-4 inline mr-2" />
                  Nom complet
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Jean Dupont"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  required={!isLogin}
                />
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                <Mail className="w-4 h-4 inline mr-2" />
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="vous@exemple.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                <Lock className="w-4 h-4 inline mr-2" />
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {!isLogin && (
                <p className="text-xs text-gray-500 mt-1">
                  Minimum 6 caractères
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                  Chargement...
                </span>
              ) : isLogin ? (
                "Se connecter"
              ) : (
                "S'inscrire"
              )}
            </button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">OU</span>
              </div>
            </div>

            {/* Google Login */}
            {GOOGLE_CLIENT_ID &&
            GOOGLE_CLIENT_ID !== "YOUR_GOOGLE_CLIENT_ID" ? (
              <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                <div className="w-full">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    text={isLogin ? "signin_with" : "signup_with"}
                  />
                </div>
              </GoogleOAuthProvider>
            ) : (
              <p className="text-center text-xs text-gray-500 p-3 bg-gray-50 rounded-lg">
                ⚠️ Google OAuth non configuré. Ajouter
                REACT_APP_GOOGLE_CLIENT_ID au fichier .env
              </p>
            )}
          </form>

          {/* Lien info */}
          <p className="text-center text-sm text-gray-600 mt-6">
            {isLogin ? (
              <>
                Pas encore inscrit?{" "}
                <button
                  onClick={() => setIsLogin(false)}
                  className="text-blue-600 hover:underline font-semibold"
                >
                  Créer un compte
                </button>
              </>
            ) : (
              <>
                Déjà inscrit?{" "}
                <button
                  onClick={() => setIsLogin(true)}
                  className="text-blue-600 hover:underline font-semibold"
                >
                  Se connecter
                </button>
              </>
            )}
          </p>
        </div>

        {/* Info Footer */}
        <p className="text-center text-blue-100 text-xs mt-6">
          Données sécurisées et chiffrées • Protection des données RGPD
        </p>
      </div>
    </div>
  );
};

export default Login;
