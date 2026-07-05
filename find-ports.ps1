function Get-FreePort {
    param([int]$Start)
    $port = $Start
    while ($true) {
        try {
            $inUse = Get-NetTCPConnection -LocalPort $port -ErrorAction Stop
        } catch {
            return $port
        }
        $port++
    }
}

$apiPort = Get-FreePort(8000)
$frontendPort = Get-FreePort(3000)

Write-Output "$apiPort $frontendPort"
