#!/bin/bash
set -e

echo "=== RCM Health Check ==="
curl -sf http://localhost:8000/health && echo "API: OK" || echo "API: FAIL"
curl -sf http://localhost:3000 > /dev/null && echo "Frontend: OK" || echo "Frontend: FAIL"
docker compose ps
