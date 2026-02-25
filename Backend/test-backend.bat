@echo off
echo ================================
echo Test Backend Uptime Monitor
echo ================================
echo.

set BASE_URL=http://localhost:3001

echo [1] Test de sante du serveur...
curl -s %BASE_URL%/health
echo.
echo.

echo [2] Creation du compte admin...
curl -s -X POST %BASE_URL%/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@test.com\",\"password\":\"admin123\",\"name\":\"Admin\"}" > response.json
echo Reponse enregistree dans response.json
echo.

echo [3] Connexion...
echo IMPORTANT: Copiez le token de response.json
echo Puis executez: set TOKEN=votre_token_ici
echo.

pause

echo [4] Creation de monitors (assurez-vous d'avoir defini TOKEN)...
curl -s -X POST %BASE_URL%/api/monitors ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -d "{\"name\":\"Google\",\"url\":\"https://www.google.com\",\"type\":\"https\",\"interval\":1}"
echo.

curl -s -X POST %BASE_URL%/api/monitors ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -d "{\"name\":\"GitHub\",\"url\":\"https://github.com\",\"type\":\"https\",\"interval\":1}"
echo.

curl -s -X POST %BASE_URL%/api/monitors ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer %TOKEN%" ^
  -d "{\"name\":\"YouTube\",\"url\":\"https://www.youtube.com\",\"type\":\"https\",\"interval\":1}"
echo.

echo [5] Liste des monitors...
curl -s -X GET %BASE_URL%/api/monitors ^
  -H "Authorization: Bearer %TOKEN%" > monitors.json
echo Reponse enregistree dans monitors.json
type monitors.json
echo.

echo [6] Attente de 60 secondes pour le monitoring automatique...
timeout /t 60 /nobreak
echo.

echo [7] Verification des statistiques mises a jour...
curl -s -X GET %BASE_URL%/api/monitors ^
  -H "Authorization: Bearer %TOKEN%" > monitors_updated.json
echo Reponse enregistree dans monitors_updated.json
type monitors_updated.json
echo.

echo ================================
echo Test termine !
echo ================================
pause
