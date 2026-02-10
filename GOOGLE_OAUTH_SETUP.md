# Configuration Google OAuth 2.0

## 📋 Étapes pour configurer Google Sign-In

### 1. Créer un projet Google Cloud

1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un nouveau projet ou sélectionnez un projet existant
3. Allez dans **API et services** → **Identifiants**

### 2. Créer des identifiants OAuth 2.0

1. Cliquez sur **+ Créer des identifiants** → **ID client OAuth**
2. Sélectionnez le type d'application : **Application web**
3. Configurez les origines autorisées :
   - **Origines JavaScript autorisées** :
     - `http://localhost:3000`
     - `http://localhost`
     - Votre domaine en production (ex: `https://monsite.com`)
   - **URI de redirection autorisé** :
     - `http://localhost:3000`
     - Votre URL de production

4. Cliquez sur **Créer**
5. Copiez votre **ID client** (commence par `xxxxx.apps.googleusercontent.com`)

### 3. Configurer l'application UptimeWarden

1. Créez un fichier `.env` dans le dossier `client/` :

```bash
cp .env.example .env
```

2. Ajoutez votre Google Client ID :

```env
REACT_APP_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE
REACT_APP_API_URL=http://localhost:5000/api
```

Remplacez `YOUR_GOOGLE_CLIENT_ID_HERE` par votre ID client réel.

### 4. Redémarrer l'application

```bash
cd client
npm start
```

Le bouton "Se connecter avec Google" devrait maintenant être visible sur la page de connexion.

## 🔧 Configuration supplémentaire

### Écran de consentement OAuth

Si c'est la première fois, vous devrez configurer l'écran de consentement :

1. Allez dans **OAuth consent screen**
2. Sélectionnez le type d'utilisateur : **Externe** (pour test)
3. Remplissez les informations requises :
   - **Nom de l'application** : UptimeWarden
   - **Email de support utilisateur** : votre email
4. Cliquez sur **Créer**

### Utilisateurs de test (mode développement)

1. Dans la console Google Cloud, ajoutez des emails de test
2. Ces utilisateurs peuvent se connecter sans vérification d'identité
3. En production, supprimez le mode test

## 🚀 Fonctionnement

Quand un utilisateur clique sur "Se connecter avec Google" :

1. ✅ Une popup Google s'ouvre
2. ✅ L'utilisateur se connecte avec son compte Google
3. ✅ Un JWT token est renvoyé au client
4. ✅ Le client envoie le token au serveur backend
5. ✅ Le serveur vérifie et crée/met à jour l'utilisateur
6. ✅ L'utilisateur est connecté à UptimeWarden

## 🐛 Dépannage

### Erreur: "Google OAuth non configuré"

- Vérifiez que `REACT_APP_GOOGLE_CLIENT_ID` est défini dans `.env`
- Redémarrez l'application après modification du `.env`

### Erreur "Popup bloquée"

- Les navigateurs peuvent bloquer les popups
- Vérifiez les paramètres de sécurité de votre navigateur

### Erreur "CORS"

- Assurez-vous que l'URL est dans les "Origines autorisées" de Google
- Relancez l'application

### Token invalide

- Vérifiez que l'ID client Google est correct
- Vérifiez les les logs du serveur pour plus de détails

## 📚 Ressources

- [Documentation Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Google Sign-In pour le Web](https://developers.google.com/identity/sign-in/web)
- [@react-oauth/google Documentation](https://www.npmjs.com/package/@react-oauth/google)

## 🔐 Sécurité

⚠️ **Important pour la production** :

- Ne commitez jamais votre `.env` avec les vraies clés (utilisez `.gitignore`)
- Utilisez des variables d'environnement du serveur pour les clés sensibles
- Vérifiez les tokens Google côté serveur (implémentation de base incluse)
- Validez toujours les données reçues du client

## ✅ Vérifier la configuration

Pour vérifier que tout fonctionne :

1. Lancez le serveur : `cd server && npm start`
2. Lancez le client : `cd client && npm start`
3. Allez sur `http://localhost:3000`
4. Cliquez sur l'onglet "Inscription"
5. Le bouton Google devrait s'afficher
6. Testez la connexion avec un compte Google de test
