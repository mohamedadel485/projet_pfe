@echo off
echo Test de diagnostic du serveur
echo ================================
echo.

echo [1] Test de sante...
curl -v http://localhost:3001/health
echo.
echo.

echo [2] Test Register...
curl -v -X POST http://localhost:3001/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@test.com\",\"password\":\"test123\",\"name\":\"Test User\"}"
echo.
echo.

echo Si vous voyez une erreur, copiez le message complet ci-dessus
pause
