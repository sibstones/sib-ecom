
set -e

cd "$(dirname "$0")/.."
PROJECT_ROOT="$(pwd)"
[ -f .env ] && set -a && . ./.env && set +a

echo "[dev-start] Check Docker..."
if ! docker info >/dev/null 2>&1; then
  echo ""
  echo "  Error: Docker is not running."
  echo "  Start Docker Desktop and try again."
  echo ""
  exit 1
fi

echo "[dev-start] Starting postgres, minio, backend..."
docker compose up -d postgres minio backend

echo "[dev-start] Waiting for backend to be ready (up to 90 seconds)..."
API_PORT="${PORT:-3001}"
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${API_PORT}/api/auth/csrf-token" 2>/dev/null | grep -q "200"; then
    echo "[dev-start] Backend is ready at http://localhost:${API_PORT}"
    echo ""
    echo "  Start frontend:  cd frontend && npm run dev"
    echo "  Ensure frontend/.env is set: VITE_API_PROXY_TARGET=${API_PORT}"
    echo ""
    exit 0
  fi
  ATTEMPT=$((ATTEMPT + 1))
  sleep 3
done

echo ""
echo "  Timeout: backend did not respond within 90 seconds"
echo "  Check logs: docker compose logs backend"
echo ""
exit 1
