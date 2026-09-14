<#
.SYNOPSIS
    End-to-End Diagnostic and Verification Suite for Coolify VPS, SSL/TLS, and LINE Webhook.
.DESCRIPTION
    Performs 6 comprehensive diagnostic tests against https://vcrmx.online:
    1. DNS Resolution (A, AAAA, NS)
    2. TCP Connectivity (Ports 80 & 443)
    3. SSL/TLS Certificate Inspection (Issuer, Subject, Validity, Root Trust)
    4. HTTP to HTTPS Redirection
    5. Application Health Endpoint (GET /api/health)
    6. LINE Webhook Verification Ping (POST /api/webhooks/line with HMAC-SHA256)
.PARAMETER Domain
    Target domain to test (Default: vcrmx.online)
.PARAMETER ExpectedIp
    Expected VPS IP address (Default: 187.77.147.16)
.PARAMETER ChannelSecret
    LINE Channel Secret for computing verification signature (Default: from line_config.json)
.PARAMETER TimeoutSeconds
    Network timeout per probe in seconds (Default: 10)
.PARAMETER VerboseOutput
    Display detailed diagnostic traces
#>

[CmdletBinding()]
param (
    [string]$Domain = "vcrmx.online",
    [string]$ExpectedIp = "187.77.147.16",
    [string]$ChannelSecret = "f40ae1f3b30c2c02ceaa22f04a86e582",
    [int]$TimeoutSeconds = 10,
    [switch]$VerboseOutput
)

$ErrorActionPreference = "Continue"

# Setup Color Helpers
function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host "================================================================================" -ForegroundColor Cyan
}

function Write-Step {
    param([string]$Number, [string]$Title)
    Write-Host ""
    Write-Host "[$Number] $Title" -ForegroundColor Yellow
    Write-Host ("-" * ($Title.Length + 4)) -ForegroundColor DarkGray
}

function Write-Pass {
    param([string]$Message)
    Write-Host "  [PASS] $Message" -ForegroundColor Green
}

function Write-Fail {
    param([string]$Message, [string]$Remediation = "")
    Write-Host "  [FAIL] $Message" -ForegroundColor Red
    if ($Remediation) {
        Write-Host "         -> FIX: $Remediation" -ForegroundColor DarkYellow
    }
}

function Write-Warn {
    param([string]$Message, [string]$Advice = "")
    Write-Host "  [WARN] $Message" -ForegroundColor Yellow
    if ($Advice) {
        Write-Host "         -> NOTE: $Advice" -ForegroundColor DarkYellow
    }
}

function Write-Info {
    param([string]$Message)
    Write-Host "  [INFO] $Message" -ForegroundColor Gray
}

# Test Results Tracking
$TestResults = [System.Collections.Generic.List[PSCustomObject]]::new()

function Record-Result {
    param([string]$Name, [string]$Status, [string]$Details)
    $TestResults.Add([PSCustomObject]@{
        Check   = $Name
        Status  = $Status
        Details = $Details
    })
}

Write-Header "COOLIFY VPS & SSL DIAGNOSTIC VERIFICATION TOOL"
Write-Info "Target Domain    : $Domain"
Write-Info "Expected VPS IP  : $ExpectedIp"
Write-Info "Timeout Seconds  : $TimeoutSeconds"
Write-Info "Execution Time   : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')"

# ==============================================================================
# CHECK 1: DNS Resolution
# ==============================================================================
Write-Step "1/6" "DNS Resolution Inspection (A, AAAA, NS)"
$DnsSuccess = $false
$ResolvedIpv4List = @()
$ResolvedIpv6List = @()

try {
    if (Get-Command Resolve-DnsName -ErrorAction SilentlyContinue) {
        $aRecords = Resolve-DnsName -Name $Domain -Type A -ErrorAction SilentlyContinue
        foreach ($rec in $aRecords) {
            if ($rec.IP4Address) { $ResolvedIpv4List += $rec.IP4Address }
        }

        $aaaaRecords = Resolve-DnsName -Name $Domain -Type AAAA -ErrorAction SilentlyContinue
        foreach ($rec in $aaaaRecords) {
            if ($rec.IP6Address) { $ResolvedIpv6List += $rec.IP6Address }
        }

        $nsRecords = Resolve-DnsName -Name $Domain -Type NS -ErrorAction SilentlyContinue
        if ($nsRecords) {
            $nsNames = ($nsRecords | ForEach-Object { $_.NameHost }) -join ", "
            Write-Info "Nameservers (NS)   : $nsNames"
        }
    } else {
        $addresses = [System.Net.Dns]::GetHostAddresses($Domain)
        foreach ($addr in $addresses) {
            if ($addr.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork) {
                $ResolvedIpv4List += $addr.IPAddressToString
            } elseif ($addr.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetworkV6) {
                $ResolvedIpv6List += $addr.IPAddressToString
            }
        }
    }

    if ($ResolvedIpv4List.Count -eq 0) {
        Write-Fail "Domain '$Domain' did not resolve to any IPv4 A record." "Configure an A record pointing to $ExpectedIp in your DNS registrar."
        Record-Result "DNS IPv4 Resolution" "FAIL" "No IPv4 address resolved"
    } else {
        Write-Info "Resolved IPv4      : $($ResolvedIpv4List -join ', ')"
        if ($ResolvedIpv4List -contains $ExpectedIp) {
            Write-Pass "A record matches expected VPS IP ($ExpectedIp)."
            Record-Result "DNS IPv4 Resolution" "PASS" "Resolved to $ExpectedIp"
            $DnsSuccess = $true
        } else {
            Write-Warn "A record ($($ResolvedIpv4List -join ', ')) does not match expected IP ($ExpectedIp). (Could be Cloudflare Proxy)." "If using direct VPS, update DNS A record to $ExpectedIp."
            Record-Result "DNS IPv4 Resolution" "WARN" "Resolved to $($ResolvedIpv4List -join ', ')"
            $DnsSuccess = $true
        }
    }

    if ($ResolvedIpv6List.Count -gt 0) {
        Write-Warn "Found IPv6 (AAAA) record: $($ResolvedIpv6List -join ', ')" "Let's Encrypt prefers IPv6. If your VPS does not have IPv6 configured, remove this AAAA record."
    } else {
        Write-Info "IPv6 (AAAA) Record : None (Standard direct IPv4 configuration)"
    }
} catch {
    Write-Fail "DNS resolution failed: $($_.Exception.Message)" "Check internet connection and DNS settings."
    Record-Result "DNS IPv4 Resolution" "FAIL" $_.Exception.Message
}

# ==============================================================================
# CHECK 2: TCP Port Reachability (Ports 80 & 443)
# ==============================================================================
Write-Step "2/6" "TCP Port Reachability (Ports 80 & 443 on $ExpectedIp)"

function Test-TcpPort {
    param([string]$Ip, [int]$Port, [int]$TimeoutSec)
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $connectTask = $tcpClient.ConnectAsync($Ip, $Port)
    $completed = $connectTask.Wait($TimeoutSec * 1000)
    $connected = $completed -and $tcpClient.Connected
    $tcpClient.Close()
    return $connected
}

# Test Port 80 (HTTP / Let's Encrypt ACME challenge)
$Port80Open = $false
try {
    $Port80Open = Test-TcpPort -Ip $ExpectedIp -Port 80 -TimeoutSec $TimeoutSeconds
    if ($Port80Open) {
        Write-Pass "TCP Port 80 (HTTP) is open and accepting connections."
        Record-Result "Port 80 Reachability" "PASS" "Open"
    } else {
        Write-Fail "TCP Port 80 is CLOSED or TIMED OUT on $ExpectedIp." "Run 'sudo ufw allow 80/tcp && sudo ufw reload' on VPS. Let's Encrypt HTTP-01 requires port 80."
        Record-Result "Port 80 Reachability" "FAIL" "Port 80 closed / timed out"
    }
} catch {
    Write-Fail "Error testing Port 80: $($_.Exception.Message)" "Check VPS firewall and security group."
    Record-Result "Port 80 Reachability" "FAIL" $_.Exception.Message
}

# Test Port 443 (HTTPS)
$Port443Open = $false
try {
    $Port443Open = Test-TcpPort -Ip $ExpectedIp -Port 443 -TimeoutSec $TimeoutSeconds
    if ($Port443Open) {
        Write-Pass "TCP Port 443 (HTTPS) is open and accepting connections."
        Record-Result "Port 443 Reachability" "PASS" "Open"
    } else {
        Write-Fail "TCP Port 443 is CLOSED or TIMED OUT on $ExpectedIp." "Run 'sudo ufw allow 443/tcp && sudo ufw reload' on VPS."
        Record-Result "Port 443 Reachability" "FAIL" "Port 443 closed / timed out"
    }
} catch {
    Write-Fail "Error testing Port 443: $($_.Exception.Message)" "Check VPS firewall."
    Record-Result "Port 443 Reachability" "FAIL" $_.Exception.Message
}

# ==============================================================================
# CHECK 3: SSL/TLS Certificate Inspection
# ==============================================================================
Write-Step "3/6" "SSL/TLS Certificate Chain & SNI Inspection"

$CapturedCert = $null
$SslValidationErrors = @()
$TlsSuccess = $false

try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect($Domain, 443)
    
    $callback = {
        param($sender, $cert, $chain, $errors)
        $script:CapturedCert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($cert)
        if ($errors -ne [System.Net.Security.SslPolicyErrors]::None) {
            $script:SslValidationErrors += $errors.ToString()
        }
        return $true # Continue handshake to inspect cert even if untrusted
    }

    $sslStream = New-Object System.Net.Security.SslStream($tcp.GetStream(), $false, $callback)
    $sslStream.AuthenticateAsClient($Domain)
    $tlsProtocol = $sslStream.SslProtocol.ToString()
    $sslStream.Close()
    $tcp.Close()

    if ($CapturedCert) {
        $subject = $CapturedCert.Subject
        $issuer = $CapturedCert.Issuer
        $notBefore = $CapturedCert.NotBefore
        $notAfter = $CapturedCert.NotAfter
        $daysRemaining = [math]::Round(($notAfter - (Get-Date)).TotalDays)

        Write-Info "Negotiated TLS     : $tlsProtocol"
        Write-Info "Certificate Subject: $subject"
        Write-Info "Certificate Issuer : $issuer"
        Write-Info "Validity Window    : $notBefore to $notAfter ($daysRemaining days remaining)"

        if ($issuer -match "TRAEFIK DEFAULT CERT") {
            Write-Fail "Server is serving 'TRAEFIK DEFAULT CERT' (Self-Signed fallback)." `
                "Let's Encrypt failed to provision. Ensure domain has 'https://' in Coolify, port 80 is open in UFW, and acme.json is chmod 600."
            Record-Result "SSL Certificate" "FAIL" "Traefik fallback self-signed cert served"
        } elseif ($SslValidationErrors.Count -gt 0 -and ($SslValidationErrors -join ',') -ne 'None') {
            Write-Fail "Certificate validation error: $($SslValidationErrors -join ', ')" `
                "Untrusted root authority. Ensure Let's Encrypt certificate is issued."
            Record-Result "SSL Certificate" "FAIL" "Validation errors: $($SslValidationErrors -join ', ')"
        } else {
            Write-Pass "Trusted Certificate installed! Issuer: $issuer"
            Record-Result "SSL Certificate" "PASS" "Trusted issuer: $issuer"
            $TlsSuccess = $true
        }
    } else {
        Write-Fail "No SSL certificate could be captured during TLS handshake." "Verify Traefik is running and accepting TLS."
        Record-Result "SSL Certificate" "FAIL" "No certificate retrieved"
    }
} catch {
    Write-Fail "TLS Handshake Exception: $($_.Exception.Message)" `
        "Traefik may not be listening on port 443 or connection timed out."
    Record-Result "SSL Certificate" "FAIL" $_.Exception.Message
}

# ==============================================================================
# CHECK 4: HTTP to HTTPS Redirection
# ==============================================================================
Write-Step "4/6" "HTTP to HTTPS Redirection Check (Port 80 -> Port 443)"

try {
    $httpUrl = "http://$Domain/"
    $request = [System.Net.HttpWebRequest]::Create($httpUrl)
    $request.AllowAutoRedirect = $false
    $request.Timeout = $TimeoutSeconds * 1000
    $request.UserAgent = "Coolify-SSL-Diagnostic/1.0"
    
    $response = $null
    try {
        $response = $request.GetResponse()
    } catch [System.Net.WebException] {
        $response = $_.Exception.Response
    }

    if ($response) {
        $statusCode = [int]$response.StatusCode
        $location = $response.Headers["Location"]
        $response.Close()

        Write-Info "HTTP Status Code   : $statusCode"
        Write-Info "Location Header    : $location"

        if ($statusCode -in 301, 302, 307, 308 -and $location -match "^https://") {
            Write-Pass "HTTP correctly redirects to HTTPS ($statusCode -> $location)."
            Record-Result "HTTP->HTTPS Redirect" "PASS" "Status $statusCode redirects to $location"
        } elseif ($statusCode -eq 200) {
            Write-Warn "HTTP returned 200 OK without redirecting to HTTPS." "Configure Traefik redirect-to-https middleware in Coolify."
            Record-Result "HTTP->HTTPS Redirect" "WARN" "No redirect (Returned 200)"
        } else {
            Write-Warn "Unexpected HTTP status: $statusCode (Location: $location)" "Check Traefik HTTP router configuration."
            Record-Result "HTTP->HTTPS Redirect" "WARN" "Status $statusCode"
        }
    } else {
        Write-Fail "Could not establish HTTP connection to $httpUrl" "Verify port 80 is reachable and Traefik 'web' entrypoint is active."
        Record-Result "HTTP->HTTPS Redirect" "FAIL" "No HTTP response"
    }
} catch {
    Write-Fail "HTTP probe error: $($_.Exception.Message)" "Check port 80 reachability."
    Record-Result "HTTP->HTTPS Redirect" "FAIL" $_.Exception.Message
}

# ==============================================================================
# CHECK 5: Application Health Endpoint (GET /api/health)
# ==============================================================================
Write-Step "5/6" "Application Health Check (GET https://$Domain/api/health)"

# Helper function to invoke web request with optional certificate bypass for diagnostic isolation
function Invoke-ProbeRequest {
    param(
        [string]$Uri,
        [string]$Method = "GET",
        [hashtable]$Headers = @{},
        [string]$Body = "",
        [bool]$SkipCertCheck = $false
    )

    $origCallback = [System.Net.ServicePointManager]::ServerCertificateValidationCallback
    if ($SkipCertCheck) {
        [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
    }

    try {
        $req = [System.Net.HttpWebRequest]::Create($Uri)
        $req.Method = $Method
        $req.Timeout = $TimeoutSeconds * 1000
        $req.UserAgent = "Coolify-SSL-Diagnostic/1.0"
        
        foreach ($k in $Headers.Keys) {
            if ($k -eq "Content-Type") {
                $req.ContentType = $Headers[$k]
            } else {
                $req.Headers.Add($k, $Headers[$k])
            }
        }

        if ($Body -and $Method -ne "GET") {
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
            $req.ContentLength = $bytes.Length
            $stream = $req.GetRequestStream()
            $stream.Write($bytes, 0, $bytes.Length)
            $stream.Close()
        }

        $res = $req.GetResponse()
        $reader = New-Object System.IO.StreamReader($res.GetResponseStream())
        $content = $reader.ReadToEnd()
        $reader.Close()
        $status = [int]$res.StatusCode
        $res.Close()

        return @{
            StatusCode = $status
            Content    = $content
            Success    = $true
            Error      = $null
        }
    } catch [System.Net.WebException] {
        $webEx = $_.Exception
        $statusCode = 0
        $content = ""
        if ($webEx.Response) {
            $statusCode = [int]$webEx.Response.StatusCode
            $r = New-Object System.IO.StreamReader($webEx.Response.GetResponseStream())
            $content = $r.ReadToEnd()
            $r.Close()
            $webEx.Response.Close()
        }
        return @{
            StatusCode = $statusCode
            Content    = $content
            Success    = $false
            Error      = $webEx.Message
        }
    } finally {
        [System.Net.ServicePointManager]::ServerCertificateValidationCallback = $origCallback
    }
}

$HealthUri = "https://$Domain/api/health"
$HealthResult = Invoke-ProbeRequest -Uri $HealthUri -Method "GET" -SkipCertCheck $false

if ($HealthResult.Success -and $HealthResult.StatusCode -eq 200) {
    Write-Pass "GET /api/health returned HTTP 200 OK!"
    Write-Info "Response Content   : $($HealthResult.Content)"
    Record-Result "Healthcheck (/api/health)" "PASS" "HTTP 200: $($HealthResult.Content)"
} else {
    # If standard HTTPS failed, test with cert bypass to isolate whether it's SSL or 503
    Write-Info "Standard TLS request failed ($($HealthResult.Error)). Retrying with TLS bypass to isolate HTTP layer..."
    $BypassResult = Invoke-ProbeRequest -Uri $HealthUri -Method "GET" -SkipCertCheck $true

    if ($BypassResult.StatusCode -eq 503) {
        Write-Fail "Server returned HTTP 503 Service Unavailable." `
            "Traefik port mismatch! In Coolify application settings, change 'Ports Exposes' to 3000 and redeploy."
        Record-Result "Healthcheck (/api/health)" "FAIL" "HTTP 503 Service Unavailable (Port mismatch)"
    } elseif ($BypassResult.StatusCode -eq 200) {
        Write-Fail "Application is running (HTTP 200), but connection failed due to SSL Certificate error." `
            "Fix Let's Encrypt certificate. Set domain to 'https://$Domain' and open port 80."
        Record-Result "Healthcheck (/api/health)" "FAIL" "SSL Certificate untrusted (App returns 200 behind proxy)"
    } else {
        Write-Fail "Healthcheck returned status $($BypassResult.StatusCode): $($BypassResult.Error)" `
            "Check application container logs: 'docker logs <container_id>' on VPS."
        Record-Result "Healthcheck (/api/health)" "FAIL" "Status $($BypassResult.StatusCode): $($BypassResult.Error)"
    }
}

# ==============================================================================
# CHECK 6: LINE Webhook Verification Simulation (POST /api/webhooks/line)
# ==============================================================================
Write-Step "6/6" "LINE Webhook Verification Simulation (POST /api/webhooks/line)"

$WebhookUri = "https://$Domain/api/webhooks/line"
$WebhookBody = '{"destination":"U00000000000000000000000000000000","events":[]}'

# Compute HMAC-SHA256 Signature
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($ChannelSecret)
$sigBytes = $hmac.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($WebhookBody))
$SignatureHeader = [Convert]::ToBase64String($sigBytes)

Write-Info "Generated Signature: $SignatureHeader"
Write-Info "Payload Body       : $WebhookBody"

$WebhookHeaders = @{
    "Content-Type"     = "application/json"
    "x-line-signature" = $SignatureHeader
}

$WebhookResult = Invoke-ProbeRequest -Uri $WebhookUri -Method "POST" -Headers $WebhookHeaders -Body $WebhookBody -SkipCertCheck $false

if ($WebhookResult.Success -and $WebhookResult.StatusCode -eq 200) {
    Write-Pass "LINE Webhook verification succeeded! Received HTTP 200 OK."
    Write-Info "Response Body      : $($WebhookResult.Content)"
    Record-Result "LINE Webhook Verify" "PASS" "HTTP 200 OK: $($WebhookResult.Content)"
} else {
    Write-Info "Standard TLS request failed ($($WebhookResult.Error)). Isolating with TLS bypass..."
    $BypassWebhook = Invoke-ProbeRequest -Uri $WebhookUri -Method "POST" -Headers $WebhookHeaders -Body $WebhookBody -SkipCertCheck $true

    if ($BypassWebhook.StatusCode -eq 200) {
        Write-Fail "Webhook logic is functional (HTTP 200), but LINE console will fail due to UNTRUSTED SSL." `
            "Resolve SSL certificate issue so LINE Developers Console can establish trusted TLS handshake."
        Record-Result "LINE Webhook Verify" "FAIL" "SSL untrusted (App logic returns 200)"
    } elseif ($BypassWebhook.StatusCode -eq 503) {
        Write-Fail "LINE Webhook returned HTTP 503 Service Unavailable." `
            "Traefik cannot route to port 3000. Set 'Ports Exposes' to 3000 in Coolify and redeploy."
        Record-Result "LINE Webhook Verify" "FAIL" "HTTP 503 Service Unavailable"
    } elseif ($BypassWebhook.StatusCode -eq 401) {
        Write-Fail "LINE Webhook returned HTTP 401 Unauthorized." `
            "Channel Secret mismatch! Verify LINE_CHANNEL_SECRET in Coolify matches LINE Developers Console."
        Record-Result "LINE Webhook Verify" "FAIL" "HTTP 401: Invalid signature"
    } else {
        Write-Fail "LINE Webhook returned status $($BypassWebhook.StatusCode): $($BypassWebhook.Error)" `
            "Check Next.js container logs on VPS: docker logs <container_name>"
        Record-Result "LINE Webhook Verify" "FAIL" "Status $($BypassWebhook.StatusCode): $($BypassWebhook.Error)"
    }
}

# ==============================================================================
# SUMMARY SCOREBOARD & ACTIONABLE GUIDANCE
# ==============================================================================
Write-Header "DIAGNOSTIC SUMMARY SCOREBOARD"

$AllPass = $true
foreach ($res in $TestResults) {
    $color = if ($res.Status -eq "PASS") { "Green" } elseif ($res.Status -eq "WARN") { "Yellow" } else { "Red" }
    Write-Host ("  {0,-28} : [{1,-4}] {2}" -f $res.Check, $res.Status, $res.Details) -ForegroundColor $color
    if ($res.Status -eq "FAIL") { $AllPass = $false }
}

Write-Host ""
if ($AllPass) {
    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host "  ALL CHECKS PASSED! LINE Webhook is ready for verification." -ForegroundColor Green
    Write-Host "  Navigate to LINE Developers Console and click 'Verify' -> Expect 'Success'." -ForegroundColor Green
    Write-Host "================================================================================" -ForegroundColor Green
    exit 0
} else {
    Write-Host "================================================================================" -ForegroundColor Red
    Write-Host "  ACTION REQUIRED: 1 or more critical checks failed." -ForegroundColor Red
    Write-Host "  Please follow the steps in COOLIFY_VPS_SSL_RESOLUTION_GUIDE.md:" -ForegroundColor Red
    Write-Host "    1. In Coolify: General -> Set 'Domains' to 'https://$Domain'" -ForegroundColor Yellow
    Write-Host "    2. In Coolify: General -> Set 'Ports Exposes' to '3000'" -ForegroundColor Yellow
    Write-Host "    3. On VPS: Run 'sudo ufw allow 80/tcp && sudo ufw allow 443/tcp'" -ForegroundColor Yellow
    Write-Host "    4. On VPS: Run 'sudo chmod 600 /data/coolify/proxy/acme.json'" -ForegroundColor Yellow
    Write-Host "    5. In Coolify: Click 'Redeploy'" -ForegroundColor Yellow
    Write-Host "================================================================================" -ForegroundColor Red
    exit 1
}
