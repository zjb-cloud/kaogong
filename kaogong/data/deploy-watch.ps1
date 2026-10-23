# Deploy watch: check GitHub Pages sync every 30 min until new version is live (max 24h)
$ErrorActionPreference = "Continue"
$log  = "C:\Users\Administrator\.openclaw\workspace\kaogong\data\deploy-watch.log"
$done = "C:\Users\Administrator\.openclaw\workspace\kaogong\data\deploy-watch.done"
$old  = "20261019.2153"
function Write-Log($msg) {
  $line = (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + " | " + $msg
  try { [IO.File]::AppendAllText($log, $line + "`r`n", (New-Object Text.UTF8Encoding $false)) } catch {}
}
if (Test-Path $done) { Write-Log "done marker exists, exit"; exit 0 }
for ($i = 1; $i -le 48; $i++) {
  try {
    $html = (Invoke-WebRequest -Uri "https://zjb-cloud.github.io/kaogong/index.html" -UseBasicParsing -TimeoutSec 30).Content
    $m = [regex]::Match($html, 'app\.js\?v=([\d.]+)')
    $ver = $m.Groups[1].Value
  } catch {
    Write-Log ("check " + $i + " FAILED: " + $_.Exception.Message + " ; retry in 30min")
    Start-Sleep -Seconds 1800; continue
  }
  if ($ver -ne $old) {
    try {
      $app = (Invoke-WebRequest -Uri ("https://zjb-cloud.github.io/kaogong/app.js?v=" + $ver) -UseBasicParsing -TimeoutSec 60).Content
      $has = $app.Contains("sbGroups")
    } catch {
      $has = $false
      Write-Log ("check " + $i + ": version changed to " + $ver + " but app.js fetch failed: " + $_.Exception.Message)
    }
    if ($has) {
      Write-Log ("DONE! new version live: " + $ver + " (app.js contains sbGroups)")
      try { [IO.File]::WriteAllText($done, "DONE " + $ver + " | " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), (New-Object Text.UTF8Encoding $false)) } catch {}
      exit 0
    } else {
      Write-Log ("check " + $i + ": version changed to " + $ver + " but sbGroups NOT confirmed, keep waiting")
    }
  } else {
    Write-Log ("check " + $i + ": still old version " + $ver + ", retry in 30min")
  }
  Start-Sleep -Seconds 1800
}
Write-Log ("reached 48 checks (24h) without detecting new version, stop. manual check needed")
exit 0
