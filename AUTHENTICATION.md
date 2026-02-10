# Système d'Authentification - Page de Login

## 📋 Vue d'ensemble

Le système d'authentification comprend une page de login/register entièrement fonctionnelle avec :

- Gestion des tokens JWT
- Contexte React pour l'authentification
- Routes protégées
- Stockage local des sessions

## 🏗️ Architecture

### Fichiers principaux

```
src/
├── contexts/
│   └── AuthContext.js          # Contexte d'authentification
├── components/
│   ├── Login.js               # Page de login/register
│   ├── ProtectedRoute.js      # Composant pour protéger les routes
│   └── Header.js              # Barre supérieure avec infos utilisateur
├── App.js                      # App principale avec routing
└── api.js                      # Configuration axios
```

## 🔧 Composants

### AuthContext

Fournit :

- `user` - Informations utilisateur
- `token` - Token JWT stocké
- `loading` - État de chargement
- `isAuthenticated` - Boolean pour authentification
- `login(email, password)` - Fonction de connexion
- `register(email, password, name)` - Fonction d'inscription
- `logout()` - Fonction de déconnexion

### Login Component

- Onglets Connexion/Inscription
- Formulaire réactif
- Validation des champs
- Gestion des erreurs
- UI responsive avec Tailwind CSS
- Affichage/masquage du mot de passe

### Header Component

- Affiche le nom de l'utilisateur
- Bouton de déconnexion
- Remplace l'ancienne barre de navigation

### ProtectedRoute Component

- Vérifie si l'utilisateur est authentifié
- Redirige vers Login si besoin
- Affiche un indicateur de chargement pendant la vérification

## 🚀 Utilisation

### Installation

```bash
npm install
```

### Démarrage en développement

```bash
# Terminal 1 - Server
cd server
npm run dev

# Terminal 2 - Client
cd client
npm start
```

### Créer un compte

1. Accédez à http://localhost:3000
2. Cliquez sur "Inscription"
3. Remplissez le formulaire avec :
   - Nom complet
   - Email
   - Mot de passe (minimum 6 caractères)
4. Cliquez sur "S'inscrire"

### Se connecter

1. Cliquez sur "Connexion"
2. Entrez votre email et mot de passe
3. Cliquez sur "Se connecter"

### Se déconnecter

1. Cliquez sur le bouton "Déconnexion" en haut à droite
2. Confirmez l'action

## 📡 Points d'accès API

### Endpoints d'authentification

```bash
# Inscription
POST /api/auth/register
{
  "name": "Jean Dupont",
  "email": "jean@example.com",
  "password": "motdepasse"
}

# Réponse
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Jean Dupont",
    "email": "jean@example.com"
  }
}

# Connexion
POST /api/auth/login
{
  "email": "jean@example.com",
  "password": "motdepasse"
}

# Réponse (identique à l'inscription)
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { ... }
}
```

## 🔐 Sécurité

- Les tokens sont stockés dans `localStorage`
- Les mots de passe sont hashés côté serveur (bcryptjs)
- Les requêtes API incluent automatiquement le token dans l'en-tête Authorization
- Les sessions persistent lors du rechargement

## 🎨 Personnalisation

### Modifier les couleurs

Éditez [Login.js](./src/components/Login.js) et modifiez les classes Tailwind :

- `bg-blue-600` → Couleur primaire
- `bg-white` → Couleur de fond

### Modifier le logo

Remplacez l'icône `Lock` dans `Header.js` et `Login.js` par votre propre logo.

### Ajouter des champs d'inscription

Editez `Login.js` :

```javascript
// Ajoutez dans formData
const [formData, setFormData] = useState({
  email: "",
  password: "",
  name: "",
  phone: "", // Nouveau champ
});

// Ajoutez l'input dans le formulaire
<input
  type="tel"
  name="phone"
  value={formData.phone}
  onChange={handleChange}
  placeholder="Téléphone"
/>;
```

## 🐛 Dépannage

### "Token non fourni" ou "Token invalide"

- Vérifiez que le serveur est en cours d'exécution sur le port 5000
- Vérifiez la variable `JWT_SECRET` dans le serveur
- Essayez de vous reconnecter

### CORS errors

- Assurez-vous que `cor` est activé sur le serveur (voir `backend_server_js.js`)
- Vérifiez que `REACT_APP_API_URL` pointe vers le bon endpoint

### Pas de redirection après connexion

- Vérifiez que `onLoginSuccess` appelle `window.location.reload()`
- Ou utilisez un routeur (React Router) pour une meilleure gestion des routes

## 📚 Exemple complet avec React Router

Si vous souhaitez utiliser React Router pour un meilleur routing :

```bash
npm install react-router-dom
```

Voir la [documentation officielle](https://reactrouter.com/en/main) pour l'intégration.

## 📝 Variables d'environnement

Créez un fichier `.env` à la racine du dossier client :

```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_DEBUG=false
```

## 🔗 Voir aussi

- [API Documentation](../api_documentation.md)
- [Database Schema](../database_schema.md)
- [Server README](../server/README.md)
