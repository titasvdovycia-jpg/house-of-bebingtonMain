# start-server.ps1
# A tiny standalone web server using native PowerShell (no Node/Python required)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:8000/") # Listen on all interfaces
$listener.Start()

$LogFile = Join-Path $PWD "logs.txt"

Write-Host "=========================================================="
Write-Host "   House of Bebington Local Server is running!         "
Write-Host "=========================================================="
Write-Host ""
Write-Host "Accessible at:"
Write-Host "Local : http://127.0.0.1:8000/"
Write-Host "Remote: http://$([System.Net.Dns]::GetHostEntry($env:COMPUTERNAME).AddressList | Where-Object { $_.AddressFamily -eq 'InterNetwork' } | Select-Object -First 1):8000/"
Write-Host ""
Write-Host "Press Ctrl+C to stop the server when you are done."

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        # Log IP
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $ip = $request.RemoteEndPoint.Address.ToString()
        "$timestamp - Access from $ip - $($request.Url.LocalPath)" | Out-File -FilePath $LogFile -Append

        $query = $request.Url.LocalPath
        if ($query -eq "/") { $query = "/index.html" }
        $path = Join-Path $PWD $query
        
        if (Test-Path $path) {
            $bytes = [System.IO.File]::ReadAllBytes($path)
            $response.ContentLength64 = $bytes.Length
            
            if ($path -match "\.css$") { $response.ContentType = "text/css" }
            elseif ($path -match "\.js$") { $response.ContentType = "application/javascript" }
            elseif ($path -match "\.html$") { $response.ContentType = "text/html" }
            else { $response.ContentType = "text/plain" }
            
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
        }
        $response.Close()
    } catch {
       # Ignore timeouts or closed connections
    }
}
