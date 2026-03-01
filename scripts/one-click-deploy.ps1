param(
  [switch]$ForceEnv,
  [switch]$SkipBuild,
  [int]$ApiPort = 18081,
  [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($Help) {
  @'
VeoMuse V3.1 一键安装部署脚本 (Windows PowerShell)

用法:
  powershell -ExecutionPolicy Bypass -File scripts/one-click-deploy.ps1 [-ForceEnv] [-SkipBuild] [-ApiPort 18081]

参数:
  -ForceEnv   强制重建关键安全环境变量（会备份现有 .env）
  -SkipBuild  启动时跳过镜像重建（仅 docker compose up -d）
  -ApiPort    健康检查端口（默认 18081）
'@ | Write-Host
  exit 0
}

if ($ApiPort -lt 1 -or $ApiPort -gt 65535) {
  throw "非法端口: $ApiPort"
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$EnvFile = Join-Path $RepoRoot ".env"
$EnvExampleFile = Join-Path $RepoRoot ".env.example"
$ComposeFile = Join-Path $RepoRoot "config/docker/docker-compose.yml"

function Write-Info([string]$Message) { Write-Host "[INFO] $Message" }
function Write-WarnMsg([string]$Message) { Write-Host "[WARN] $Message" -ForegroundColor Yellow }

function Test-CommandExists([string]$Name) {
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function New-RandomHex([int]$BytesLength) {
  $bytes = New-Object byte[] $BytesLength
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }
  return ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''
}

$script:ComposeMode = $null

function Initialize-Compose {
  if (-not (Test-CommandExists 'docker')) {
    throw '未检测到 docker，请先安装并启动 Docker Desktop（Windows）。'
  }

  $dockerInfoOk = $true
  try {
    docker info *> $null
  } catch {
    $dockerInfoOk = $false
  }
  if (-not $dockerInfoOk -or $LASTEXITCODE -ne 0) {
    throw 'Docker daemon 未启动，请先启动 Docker Desktop。'
  }

  $composeV2Ok = $true
  try {
    docker compose version *> $null
  } catch {
    $composeV2Ok = $false
  }

  if ($composeV2Ok -and $LASTEXITCODE -eq 0) {
    $script:ComposeMode = 'docker'
    return
  }

  if (Test-CommandExists 'docker-compose') {
    $script:ComposeMode = 'docker-compose'
    return
  }

  throw '未检测到 docker compose / docker-compose，请升级 Docker Desktop。'
}

function Invoke-Compose {
  param([string[]]$Args)

  if ($script:ComposeMode -eq 'docker') {
    & docker compose @Args
  } else {
    & docker-compose @Args
  }

  if ($LASTEXITCODE -ne 0) {
    throw "Compose 命令执行失败: $($Args -join ' ')"
  }
}

$script:EnvContent = ''

function Get-EnvValue([string]$Key) {
  $pattern = "(?m)^$([regex]::Escape($Key))=(.*)$"
  $match = [regex]::Match($script:EnvContent, $pattern)
  if (-not $match.Success) { return '' }
  $value = $match.Groups[1].Value.Trim()
  if ($value.StartsWith('"') -and $value.EndsWith('"') -and $value.Length -ge 2) {
    $value = $value.Substring(1, $value.Length - 2)
  }
  if ($value.StartsWith("'") -and $value.EndsWith("'") -and $value.Length -ge 2) {
    $value = $value.Substring(1, $value.Length - 2)
  }
  return $value
}

function Set-EnvValue([string]$Key, [string]$Value) {
  $line = "$Key=$Value"
  $pattern = "(?m)^$([regex]::Escape($Key))=.*$"
  $regex = [regex]::new($pattern)

  if ($regex.IsMatch($script:EnvContent)) {
    $script:EnvContent = $regex.Replace($script:EnvContent, $line, 1)
  } else {
    if ($script:EnvContent.Length -gt 0 -and -not $script:EnvContent.EndsWith("`n")) {
      $script:EnvContent += "`n"
    }
    if ($script:EnvContent.Length -gt 0) {
      $script:EnvContent += "`n"
    }
    $script:EnvContent += "$line`n"
  }
}

function Test-WeakValue([string]$Value, [int]$MinLength) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return $true }
  $lower = $Value.ToLowerInvariant()
  if ($lower.Contains('replace-with') -or $lower.Contains('changeme') -or $lower.Contains('your_key') -or $lower.Contains('example')) {
    return $true
  }
  return $Value.Length -lt $MinLength
}

function Prepare-EnvFile {
  if (-not (Test-Path $EnvFile)) {
    if (Test-Path $EnvExampleFile) {
      Copy-Item $EnvExampleFile $EnvFile
      Write-Info '已从 .env.example 生成 .env'
    } else {
      New-Item -ItemType File -Path $EnvFile -Force | Out-Null
      Write-Info '已创建空 .env'
    }
  } elseif ($ForceEnv) {
    $backupName = ".env.backup.$(Get-Date -Format 'yyyyMMddHHmmss')"
    $backupPath = Join-Path $RepoRoot $backupName
    Copy-Item $EnvFile $backupPath
    Write-Info "已备份原 .env -> $backupName"
  }

  $script:EnvContent = (Get-Content -Path $EnvFile -Raw)

  $jwt = Get-EnvValue 'JWT_SECRET'
  if ($ForceEnv -or (Test-WeakValue $jwt 32)) {
    Set-EnvValue 'JWT_SECRET' (New-RandomHex 32)
    Write-Info '已设置安全 JWT_SECRET'
  }

  $secretKey = Get-EnvValue 'SECRET_ENCRYPTION_KEY'
  if ($ForceEnv -or (Test-WeakValue $secretKey 32)) {
    Set-EnvValue 'SECRET_ENCRYPTION_KEY' (New-RandomHex 32)
    Write-Info '已设置安全 SECRET_ENCRYPTION_KEY'
  }

  $adminToken = Get-EnvValue 'ADMIN_TOKEN'
  if ($ForceEnv -or (Test-WeakValue $adminToken 20)) {
    Set-EnvValue 'ADMIN_TOKEN' (New-RandomHex 24)
    Write-Info '已设置安全 ADMIN_TOKEN'
  }

  $redisPassword = Get-EnvValue 'REDIS_PASSWORD'
  if ($ForceEnv -or (Test-WeakValue $redisPassword 12)) {
    Set-EnvValue 'REDIS_PASSWORD' ("vm_" + (New-RandomHex 16))
    Write-Info '已设置安全 REDIS_PASSWORD'
  }

  $nodeEnv = Get-EnvValue 'NODE_ENV'
  if ([string]::IsNullOrWhiteSpace($nodeEnv) -or $nodeEnv -ne 'production') {
    Set-EnvValue 'NODE_ENV' 'production'
    Write-Info '已设置 NODE_ENV=production'
  }

  $gemini = Get-EnvValue 'GEMINI_API_KEYS'
  if ([string]::IsNullOrWhiteSpace($gemini) -or $gemini.Contains('your_key')) {
    Write-WarnMsg 'GEMINI_API_KEYS 尚未配置，AI 生成相关能力将返回 not_implemented。'
  }

  Set-Content -Path $EnvFile -Value $script:EnvContent -Encoding utf8
}

function Wait-ForHealth {
  $healthUrl = "http://127.0.0.1:$ApiPort/api/health"
  for ($i = 1; $i -le 60; $i++) {
    try {
      $response = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 5 -ErrorAction Stop
      if ($null -ne $response -and $response.status -eq 'ok') {
        return $true
      }
    } catch {
      # noop
    }
    Start-Sleep -Seconds 2
  }
  return $false
}

if (-not (Test-Path $ComposeFile)) {
  throw "未找到 Compose 文件: $ComposeFile"
}

Initialize-Compose
Prepare-EnvFile

Write-Info '开始拉起 VeoMuse V3.1 生产服务...'
$composeArgs = @('-f', $ComposeFile, 'up', '-d')
if (-not $SkipBuild) {
  $composeArgs += '--build'
}
Invoke-Compose -Args $composeArgs

Write-Info '等待服务健康检查...'
if (-not (Wait-ForHealth)) {
  Write-Host "[ERROR] 健康检查失败，请查看日志:"
  Write-Host "  docker compose -f $ComposeFile logs --tail=200"
  exit 1
}

Write-Info '部署成功。'
Write-Host ""
Write-Host "访问地址: http://127.0.0.1:$ApiPort"
Write-Host "停止服务: docker compose -f $ComposeFile down"
Write-Host "查看日志: docker compose -f $ComposeFile logs --tail=200"
