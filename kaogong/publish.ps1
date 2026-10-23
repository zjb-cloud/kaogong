# 发布「学习工作台」到 GitHub Pages
#   首发： powershell -NoProfile -ExecutionPolicy Bypass -File publish.ps1 -Init
#   日常： powershell -NoProfile -ExecutionPolicy Bypass -File publish.ps1 [-Message "说明"]
# 通道优先级：SSH 部署密钥 → HTTPS(token) → GitHub Contents API（api.github.com 最稳）
param([switch]$Init, [string]$Message = '')

$ErrorActionPreference = 'Continue'
$SRC    = 'C:\Users\Administrator\.openclaw\workspace\kaogong'
$DEST   = 'C:\Users\Administrator\kgpages'
$GHUSER = 'zjb-cloud'
$REPO   = 'kaogong'
$BRANCH = 'main'
$SSHKEY = Join-Path $env:USERPROFILE '.ssh\id_ed25519_kaogong'
$FILES  = @('index.html', 'app.css', 'app.js', 'README.md', '.nojekyll', 'manifest.json', 'sw.js', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png')
# 根目录下的网站校验文件（如 fe29...txt）自动一并同步
$FILES += @(Get-ChildItem (Join-Path $SRC '*.txt') -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^[0-9a-f]{32}\.txt$' } | ForEach-Object { $_.Name })

function Get-Token {
  if ($env:GH_TOKEN) { return $env:GH_TOKEN.Trim() }
  $f = Join-Path $SRC '.gh_token'
  if (Test-Path $f) { return (Get-Content $f -Raw).Trim() }
  return $null
}

function GitOut { param([string[]]$A) (& git -C $DEST @A 2>&1 | Out-String -Width 200).Trim() }

# ---- 1 准备部署目录 ----
if (-not (Test-Path (Join-Path $DEST '.git'))) {
  New-Item -ItemType Directory -Force -Path $DEST | Out-Null
  git init -q -b $BRANCH $DEST | Out-Null
  git -C $DEST config user.name $GHUSER | Out-Null
  git -C $DEST config user.email "$GHUSER@users.noreply.github.com" | Out-Null
  git -C $DEST config core.autocrlf false | Out-Null
  "初始化部署目录 $DEST"
}

# ---- 2 同步文件 ----
New-Item -ItemType Directory -Force -Path (Join-Path $DEST 'data') | Out-Null
$copied = 0
foreach ($f in $FILES) {
  $s = Join-Path $SRC $f
  if (Test-Path $s) { Copy-Item $s (Join-Path $DEST $f) -Force; $copied++ }
}
Get-ChildItem (Join-Path $SRC 'data\*.js') -ErrorAction SilentlyContinue | ForEach-Object {
  Copy-Item $_.FullName (Join-Path $DEST 'data') -Force; $copied++
}
New-Item -ItemType Directory -Force -Path (Join-Path $DEST 'data\figs') | Out-Null
Get-ChildItem (Join-Path $SRC 'data\figs\*.png') -ErrorAction SilentlyContinue | ForEach-Object {
  Copy-Item $_.FullName (Join-Path $DEST 'data\figs') -Force; $copied++
}
New-Item -ItemType Directory -Force -Path (Join-Path $DEST 'audio') | Out-Null
Get-ChildItem (Join-Path $SRC 'audio\*.mp3') -ErrorAction SilentlyContinue | ForEach-Object {
  Copy-Item $_.FullName (Join-Path $DEST 'audio') -Force; $copied++
}
Set-Content -Path (Join-Path $DEST '.nojekyll') -Value '' -NoNewline -Encoding ascii
"同步 $copied 个文件"

# ---- 2.5 注入缓存戳：每次发布换 URL，手机端不会吃旧缓存 ----
$build = Get-Date -Format 'yyyyMMdd.HHmm'
$idxPath = Join-Path $DEST 'index.html'
if (Test-Path $idxPath) {
  $c = (Get-Content $idxPath -Raw -Encoding UTF8) -replace '__BUILD__', $build
  [IO.File]::WriteAllText($idxPath, $c, (New-Object Text.UTF8Encoding $false))
  "缓存戳：$build"
}

# ---- 3 提交 ----
git -C $DEST add -A | Out-Null
$stamp = if ($Message) { $Message } else { 'update: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm') }
git -C $DEST commit -q -m $stamp 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) { "已提交：$stamp" } else { "无改动" }
$head = (git -C $DEST rev-parse HEAD).Trim()

# ---- 4 推送（三通道）----
$ok = $false; $used = ''

if (Test-Path $SSHKEY) {
  $env:GIT_SSH_COMMAND = "ssh -i `"$SSHKEY`" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20"
  git -C $DEST remote set-url origin "git@github.com:$GHUSER/$REPO.git" 2>&1 | Out-Null
  $o = GitOut @('push', '-q', 'origin', $BRANCH)
  if ($LASTEXITCODE -eq 0) { $ok = $true; $used = 'SSH' } else { "SSH 推送失败，换通道…" }
}

$token = Get-Token
if (-not $ok -and $token) {
  $o = GitOut @('-c', "http.https://github.com/.extraheader=", 'push', "https://$GHUSER`:$token@github.com/$GHUSER/$REPO.git", $BRANCH)
  if ($LASTEXITCODE -eq 0) { $ok = $true; $used = 'HTTPS' } else { "HTTPS 推送失败，换通道…" }
}

if (-not $ok -and $token) {
  # 兜底：用 GitHub Contents API 逐个文件上传（api.github.com 最稳）
  $H = @{ Authorization = "token $token"; 'User-Agent' = 'openclaw-kaogong'; Accept = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2022-11-28' }
  $items = @()
  foreach ($f in $FILES) { if ($f -ne '.nojekyll' -and (Test-Path (Join-Path $DEST $f))) { $items += $f } }
  Get-ChildItem (Join-Path $DEST 'data\*.js') | ForEach-Object { $items += ('data/' + $_.Name) }
  Get-ChildItem (Join-Path $DEST 'data\figs\*.png') -ErrorAction SilentlyContinue | ForEach-Object { $items += ('data/figs/' + $_.Name) }
  Get-ChildItem (Join-Path $DEST 'audio\*.mp3') -ErrorAction SilentlyContinue | ForEach-Object { $items += ('audio/' + $_.Name) }
  $bad = 0
  foreach ($rel in $items) {
    $local = Join-Path $DEST ($rel -replace '/', '\')
    $apiPath = "https://api.github.com/repos/$GHUSER/$REPO/contents/$rel"
    $sha = $null
    try { $g = Invoke-RestMethod -Uri "$apiPath`?ref=$BRANCH" -Headers $H -TimeoutSec 30; $sha = $g.sha } catch {}
    $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($local))
    $body = @{ message = $stamp; content = $b64; branch = $BRANCH }
    if ($sha) { $body.sha = $sha }
    try { Invoke-RestMethod -Method Put -Uri $apiPath -Headers $H -Body ($body | ConvertTo-Json) -ContentType 'application/json' -TimeoutSec 60 | Out-Null }
    catch { $bad++; "API 上传失败：$rel → $($_.Exception.Message)" }
  }
  if ($bad -eq 0) { $ok = $true; $used = 'Contents API' } else { "API 上传有 $bad 个失败" }
}

if ($ok) {
  "✅ 发布成功（通道：$used）→ https://$GHUSER.github.io/$REPO/"
} else {
  "❌ 所有通道都失败了，稍后重试"
  exit 1
}
