param(
  [Parameter(Mandatory = $false)]
  [int]$Port = 3000,

  [Parameter(Mandatory = $false)]
  [switch]$Force
)

Write-Host ("[free-port] Checking which PID is listening on port {0}..." -f $Port)

$lines = netstat -ano | findstr (":{0} " -f $Port)
if (-not $lines) {
  Write-Host ("[free-port] Port {0} is already free." -f $Port)
  exit 0
}

$pids = @()
foreach ($line in $lines) {
  if ($line -match ":\d+\s+\S+\s+\S+\s+\S+\s+LISTENING\s+(\d+)\s*$") {
    $pids += $matches[1]
  } else {
    # Fallback parse: PID is usually the last token
    $tokens = ($line -split "\s+")
    if ($tokens.Count -ge 1) {
      $maybePid = $tokens[-1]
      if ($maybePid -match "^\d+$") {
        $pids += $maybePid
      }
    }
  }
}

$pids = $pids | Sort-Object -Unique
if ($pids.Count -eq 0) {
  Write-Host ("[free-port] Found listeners, but could not parse PID for port {0}. Nothing to kill." -f $Port)
  exit 1
}

foreach ($pid in $pids) {
  $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
  $name = if ($proc) { $proc.ProcessName } else { "unknown" }

  # Safety: only auto-kill Node/Next processes unless -Force is provided.
  if (-not $Force -and $name -notin @("node", "next")) {
    Write-Warning ("[free-port] Refusing to kill PID {0} ({1}). Use -Force to override." -f $pid, $name)
    continue
  }

  Write-Host ("[free-port] Killing PID {0} ({1})..." -f $pid, $name)
  taskkill /PID $pid /F | Out-Null
}

Write-Host ("[free-port] Done. Re-check port {0} if needed." -f $Port)

