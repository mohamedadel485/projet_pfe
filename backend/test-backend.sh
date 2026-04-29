#!/bin/bash

echo "================================"
echo "Test Backend Uptime Monitor"
echo "================================"
echo ""

BASE_URL="http://localhost:3001"

echo "[1] Test de santé du serveur..."
curl -s $BASE_URL/health | jq .
echo ""

echo "[2] Création du compte admin..."
REGISTER_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin123","name":"Admin"}')

echo $REGISTER_RESPONSE | jq .
TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.token')
echo ""
echo "Token extrait: $TOKEN"
echo ""

if [ "$TOKEN" = "null" ]; then
  echo "Erreur: Impossible de créer l'admin (peut-être déjà existant?)"
  echo "Tentative de connexion..."
  
  LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@test.com","password":"admin123"}')
  
  echo $LOGIN_RESPONSE | jq .
  TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
  echo "Token de connexion: $TOKEN"
  echo ""
fi

echo "[3] Vérification du profil..."
curl -s -X GET $BASE_URL/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

echo "[4] Création de monitors..."

echo "  → Monitor Google..."
curl -s -X POST $BASE_URL/api/monitors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Google","url":"https://www.google.com","type":"https","interval":1}' | jq .
echo ""

echo "  → Monitor GitHub..."
curl -s -X POST $BASE_URL/api/monitors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"GitHub","url":"https://github.com","type":"https","interval":1}' | jq .
echo ""

echo "  → Monitor YouTube..."
curl -s -X POST $BASE_URL/api/monitors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"YouTube","url":"https://www.youtube.com","type":"https","interval":1}' | jq .
echo ""

echo "[5] Liste des monitors (avant monitoring)..."
curl -s -X GET $BASE_URL/api/monitors \
  -H "Authorization: Bearer $TOKEN" | jq '.monitors[] | {name: .name, url: .url, status: .status, uptime: .uptime, totalChecks: .totalChecks}'
echo ""

echo "[6] Attente de 65 secondes pour le monitoring automatique..."
for i in {65..1}; do
  echo -ne "\rTemps restant: $i secondes... "
  sleep 1
done
echo ""
echo ""

echo "[7] Liste des monitors (après monitoring)..."
curl -s -X GET $BASE_URL/api/monitors \
  -H "Authorization: Bearer $TOKEN" | jq '.monitors[] | {name: .name, url: .url, status: .status, uptime: .uptime, totalChecks: .totalChecks, successfulChecks: .successfulChecks, responseTime: .responseTime}'
echo ""

echo "[8] Test d'invitation d'utilisateur..."
curl -s -X POST $BASE_URL/api/invitations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"email":"user@test.com"}' | jq .
echo ""

echo "[9] Liste des invitations..."
curl -s -X GET $BASE_URL/api/invitations \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

echo "================================"
echo "Test terminé !"
echo "================================"
echo ""
echo "Résumé:"
echo "- Admin créé: admin@test.com"
echo "- Monitors créés: 3 (Google, GitHub, YouTube)"
echo "- Invitation envoyée: user@test.com"
echo ""
echo "Pour voir les logs d'un monitor, utilisez:"
echo "MONITOR_ID=\$(curl -s $BASE_URL/api/monitors -H \"Authorization: Bearer $TOKEN\" | jq -r '.monitors[0]._id')"
echo "curl -s $BASE_URL/api/monitors/\$MONITOR_ID/logs -H \"Authorization: Bearer $TOKEN\" | jq ."
