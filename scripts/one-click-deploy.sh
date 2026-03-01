#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
VeoMuse V3.1 一键安装部署脚本 (macOS/Linux)

用法:
  bash scripts/one-click-deploy.sh [--force-env] [--skip-build] [--api-port <port>]

参数:
  --force-env      强制重建关键安全环境变量（会备份现有 .env）
  --skip-build     启动时跳过镜像重建（仅 docker compose up -d）
  --api-port       健康检查端口（默认 18081）
  -h, --help       显示帮助
EOF
}

FORCE_ENV=0
SKIP_BUILD=0
API_PORT="${API_PORT:-18081}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force-env)
      FORCE_ENV=1
      shift
      ;;
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    --api-port)
      if [[ $# -lt 2 ]]; then
        echo "[ERROR] --api-port 需要一个端口值" >&2
        exit 1
      fi
      API_PORT="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[ERROR] 未知参数: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ ! "$API_PORT" =~ ^[0-9]+$ ]]; then
  echo "[ERROR] 非法端口: $API_PORT" >&2
  exit 1
fi

if [[ "${OSTYPE:-}" == msys* || "${OSTYPE:-}" == cygwin* || "${OS:-}" == "Windows_NT" ]]; then
  echo "[ERROR] 检测到 Windows 环境，请使用 scripts/one-click-deploy.ps1" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
ENV_EXAMPLE_FILE="$ROOT_DIR/.env.example"
COMPOSE_FILE="$ROOT_DIR/config/docker/docker-compose.yml"

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

log() { echo "[INFO] $*"; }
warn() { echo "[WARN] $*"; }
err() { echo "[ERROR] $*"; }

random_hex() {
  local bytes="$1"
  if command_exists openssl; then
    openssl rand -hex "$bytes"
    return 0
  fi
  if command_exists od; then
    od -An -N "$bytes" -tx1 /dev/urandom | tr -d ' \n'
    return 0
  fi
  err "缺少随机数工具（openssl/od），无法生成安全密钥"
  exit 1
}

trim_quotes() {
  local value="$1"
  value="${value#\"}"
  value="${value%\"}"
  value="${value#\'}"
  value="${value%\'}"
  printf '%s' "$value"
}

get_env_value() {
  local key="$1"
  if [[ ! -f "$ENV_FILE" ]]; then
    printf ''
    return 0
  fi
  local raw
  raw="$(grep -E "^${key}=" "$ENV_FILE" | tail -n 1 | cut -d '=' -f2- || true)"
  trim_quotes "$raw"
}

is_weak_value() {
  local value="$1"
  local min_len="$2"
  local lower
  lower="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"

  if [[ -z "$value" ]]; then
    return 0
  fi
  if [[ "$lower" == *"replace-with"* || "$lower" == *"changeme"* || "$lower" == *"your_key"* || "$lower" == *"example"* ]]; then
    return 0
  fi
  if (( ${#value} < min_len )); then
    return 0
  fi
  return 1
}

upsert_env_key() {
  local key="$1"
  local value="$2"
  local tmp
  tmp="$(mktemp)"

  if [[ -f "$ENV_FILE" ]] && grep -qE "^${key}=" "$ENV_FILE"; then
    awk -v k="$key" -v v="$value" '
      BEGIN { done = 0 }
      $0 ~ "^" k "=" { print k "=" v; done = 1; next }
      { print }
      END { if (!done) print k "=" v }
    ' "$ENV_FILE" > "$tmp"
  else
    if [[ -f "$ENV_FILE" ]]; then
      cat "$ENV_FILE" > "$tmp"
      if [[ -s "$tmp" ]]; then
        echo "" >> "$tmp"
      fi
    fi
    echo "${key}=${value}" >> "$tmp"
  fi

  mv "$tmp" "$ENV_FILE"
}

detect_compose_command() {
  if command_exists docker && docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
    return 0
  fi
  if command_exists docker-compose; then
    COMPOSE_CMD=(docker-compose)
    return 0
  fi
  return 1
}

prepare_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    if [[ -f "$ENV_EXAMPLE_FILE" ]]; then
      cp "$ENV_EXAMPLE_FILE" "$ENV_FILE"
      log "已从 .env.example 生成 .env"
    else
      touch "$ENV_FILE"
      log "已创建空 .env"
    fi
  elif (( FORCE_ENV == 1 )); then
    local backup="${ENV_FILE}.backup.$(date +%Y%m%d%H%M%S)"
    cp "$ENV_FILE" "$backup"
    log "已备份原 .env -> $(basename "$backup")"
  fi

  local jwt_secret
  jwt_secret="$(get_env_value "JWT_SECRET")"
  if (( FORCE_ENV == 1 )) || is_weak_value "$jwt_secret" 32; then
    upsert_env_key "JWT_SECRET" "$(random_hex 32)"
    log "已设置安全 JWT_SECRET"
  fi

  local secret_key
  secret_key="$(get_env_value "SECRET_ENCRYPTION_KEY")"
  if (( FORCE_ENV == 1 )) || is_weak_value "$secret_key" 32; then
    upsert_env_key "SECRET_ENCRYPTION_KEY" "$(random_hex 32)"
    log "已设置安全 SECRET_ENCRYPTION_KEY"
  fi

  local admin_token
  admin_token="$(get_env_value "ADMIN_TOKEN")"
  if (( FORCE_ENV == 1 )) || is_weak_value "$admin_token" 20; then
    upsert_env_key "ADMIN_TOKEN" "$(random_hex 24)"
    log "已设置安全 ADMIN_TOKEN"
  fi

  local redis_password
  redis_password="$(get_env_value "REDIS_PASSWORD")"
  if (( FORCE_ENV == 1 )) || is_weak_value "$redis_password" 12; then
    upsert_env_key "REDIS_PASSWORD" "vm_$(random_hex 16)"
    log "已设置安全 REDIS_PASSWORD"
  fi

  local node_env
  node_env="$(get_env_value "NODE_ENV")"
  if [[ -z "$node_env" || "$node_env" != "production" ]]; then
    upsert_env_key "NODE_ENV" "production"
    log "已设置 NODE_ENV=production"
  fi

  local gemini_keys
  gemini_keys="$(get_env_value "GEMINI_API_KEYS")"
  if [[ -z "$gemini_keys" || "$gemini_keys" == *"your_key"* ]]; then
    warn "GEMINI_API_KEYS 尚未配置，AI 生成相关能力将返回 not_implemented。"
  fi
}

wait_for_health() {
  local health_url="http://127.0.0.1:${API_PORT}/api/health"
  local max_retries=60

  for ((i = 1; i <= max_retries; i++)); do
    if command_exists curl; then
      if curl -fsS "$health_url" >/dev/null 2>&1; then
        return 0
      fi
    elif command_exists wget; then
      if wget -qO- "$health_url" >/dev/null 2>&1; then
        return 0
      fi
    else
      err "缺少 curl/wget，无法执行健康检查"
      return 1
    fi
    sleep 2
  done

  return 1
}

main() {
  if [[ ! -f "$COMPOSE_FILE" ]]; then
    err "未找到 Compose 文件: $COMPOSE_FILE"
    exit 1
  fi

  if ! command_exists docker; then
    err "未检测到 docker，请先安装 Docker Desktop（macOS）或 Docker Engine（Linux）"
    exit 1
  fi

  if ! detect_compose_command; then
    err "未检测到 docker compose / docker-compose，请升级 Docker 或安装 compose 插件"
    exit 1
  fi

  if ! docker info >/dev/null 2>&1; then
    err "Docker daemon 未启动，请先启动 Docker"
    exit 1
  fi

  prepare_env

  log "开始拉起 VeoMuse V3.1 生产服务..."
  if (( SKIP_BUILD == 1 )); then
    "${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" up -d
  else
    "${COMPOSE_CMD[@]}" -f "$COMPOSE_FILE" up -d --build
  fi

  log "等待服务健康检查..."
  if ! wait_for_health; then
    err "健康检查失败，请执行以下命令查看日志:"
    echo "  ${COMPOSE_CMD[*]} -f $COMPOSE_FILE logs --tail=200"
    exit 1
  fi

  log "部署成功。"
  echo ""
  echo "访问地址: http://127.0.0.1:${API_PORT}"
  echo "停止服务: ${COMPOSE_CMD[*]} -f $COMPOSE_FILE down"
  echo "查看日志: ${COMPOSE_CMD[*]} -f $COMPOSE_FILE logs --tail=200"
}

main
