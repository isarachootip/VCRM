#!/usr/bin/env bash
# ==============================================================================
# verify-coolify-ssl.sh
# End-to-End Diagnostic and Verification Suite for Coolify VPS, SSL/TLS, and LINE Webhook.
# Cross-platform Bash script (Linux, macOS, WSL, Git Bash).
# ==============================================================================

set -u

# Default Parameters
DOMAIN="vcrmx.online"
EXPECTED_IP="187.77.147.16"
CHANNEL_SECRET="f40ae1f3b30c2c02ceaa22f04a86e582"
TIMEOUT_SECS=10
VERBOSE=0

# ANSI Colors
C_RESET="\033[0m"
C_RED="\033[1;31m"
C_GREEN="\033[1;32m"
C_YELLOW="\033[1;33m"
C_CYAN="\033[1;36m"
C_GRAY="\033[0;90m"

# Parse CLI arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain|-d)
      DOMAIN="$2"
      shift 2
      ;;
    --ip|-i)
      EXPECTED_IP="$2"
      shift 2
      ;;
    --secret|-s)
      CHANNEL_SECRET="$2"
      shift 2
      ;;
    --timeout|-t)
      TIMEOUT_SECS="$2"
      shift 2
      ;;
    --verbose|-v)
      VERBOSE=1
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [options]"
      echo "Options:"
      echo "  -d, --domain <domain>    Target domain (Default: vcrmx.online)"
      echo "  -i, --ip <ip>            Expected VPS IP (Default: 187.77.147.16)"
      echo "  -s, --secret <secret>    LINE Channel Secret"
      echo "  -t, --timeout <secs>     Timeout in seconds (Default: 10)"
      echo "  -v, --verbose            Show verbose debug output"
      echo "  -h, --help               Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# Result Trackers
declare -a RES_NAMES=()
declare -a RES_STATUS=()
declare -a RES_DETAILS=()

record_result() {
  RES_NAMES+=("$1")
  RES_STATUS+=("$2")
  RES_DETAILS+=("$3")
}

print_header() {
  echo ""
  echo -e "${C_CYAN}================================================================================${C_RESET}"
  echo -e "${C_CYAN}  $1${C_RESET}"
  echo -e "${C_CYAN}================================================================================${C_RESET}"
}

print_step() {
  echo ""
  echo -e "${C_YELLOW}[$1] $2${C_RESET}"
  echo -e "${C_GRAY}--------------------------------------------------------------------------------${C_RESET}"
}

print_pass() {
  echo -e "  ${C_GREEN}[PASS]${C_RESET} $1"
}

print_fail() {
  echo -e "  ${C_RED}[FAIL]${C_RESET} $1"
  if [[ -n "${2:-}" ]]; then
    echo -e "         ${C_YELLOW}-> FIX: $2${C_RESET}"
  fi
}

print_warn() {
  echo -e "  ${C_YELLOW}[WARN]${C_RESET} $1"
  if [[ -n "${2:-}" ]]; then
    echo -e "         ${C_YELLOW}-> NOTE: $2${C_RESET}"
  fi
}

print_info() {
  echo -e "  ${C_GRAY}[INFO] $1${C_RESET}"
}

print_header "COOLIFY VPS & SSL DIAGNOSTIC VERIFICATION TOOL"
print_info "Target Domain    : $DOMAIN"
print_info "Expected VPS IP  : $EXPECTED_IP"
print_info "Timeout Seconds  : $TIMEOUT_SECS"
print_info "Execution Time   : $(date)"

# ==============================================================================
# CHECK 1: DNS Resolution
# ==============================================================================
print_step "1/6" "DNS Resolution Inspection (A, AAAA, NS)"

RESOLVED_IPS=""
if command -v dig &>/dev/null; then
  RESOLVED_IPS=$(dig +short A "$DOMAIN" 2>/dev/null | tr '\n' ' ' || true)
  IPV6_RECORDS=$(dig +short AAAA "$DOMAIN" 2>/dev/null | tr '\n' ' ' || true)
  NS_RECORDS=$(dig +short NS "$DOMAIN" 2>/dev/null | tr '\n' ' ' || true)
  if [[ -n "$NS_RECORDS" ]]; then
    print_info "Nameservers (NS)   : $NS_RECORDS"
  fi
elif command -v nslookup &>/dev/null; then
  RESOLVED_IPS=$(nslookup -query=A "$DOMAIN" 2>/dev/null | awk '/^Address: / { print $2 }' | grep -v '#' | tr '\n' ' ' || true)
  IPV6_RECORDS=""
else
  RESOLVED_IPS=$(getent ahosts "$DOMAIN" 2>/dev/null | awk '{ print $1 }' | sort -u | tr '\n' ' ' || true)
  IPV6_RECORDS=""
fi

if [[ -z "$RESOLVED_IPS" ]]; then
  print_fail "Domain '$DOMAIN' did not resolve to any IPv4 address." "Configure an A record pointing to $EXPECTED_IP in your DNS registrar."
  record_result "DNS IPv4 Resolution" "FAIL" "No IPv4 resolved"
else
  print_info "Resolved IPv4      : $RESOLVED_IPS"
  if echo "$RESOLVED_IPS" | grep -q "$EXPECTED_IP"; then
    print_pass "A record matches expected VPS IP ($EXPECTED_IP)."
    record_result "DNS IPv4 Resolution" "PASS" "Resolved to $EXPECTED_IP"
  else
    print_warn "A record does not match expected IP ($EXPECTED_IP). (Could be Cloudflare Proxy)." "If using direct VPS, update DNS A record to $EXPECTED_IP."
    record_result "DNS IPv4 Resolution" "WARN" "Resolved to $RESOLVED_IPS"
  fi
fi

if [[ -n "${IPV6_RECORDS:-}" ]]; then
  print_warn "Found IPv6 (AAAA) record: $IPV6_RECORDS" "Let's Encrypt prefers IPv6. If your VPS lacks IPv6, remove this AAAA record."
else
  print_info "IPv6 (AAAA) Record : None (Standard direct IPv4 configuration)"
fi

# ==============================================================================
# CHECK 2: TCP Reachability (Ports 80 and 443)
# ==============================================================================
print_step "2/6" "TCP Port Reachability (Ports 80 & 443 on $EXPECTED_IP)"

test_tcp_port() {
  local ip="$1"
  local port="$2"
  if command -v nc &>/dev/null; then
    nc -z -w "$TIMEOUT_SECS" "$ip" "$port" &>/dev/null
    return $?
  fi
  # Fallback to bash /dev/tcp
  timeout "$TIMEOUT_SECS" bash -c "</dev/tcp/$ip/$port" &>/dev/null
  return $?
}

# Test Port 80
if test_tcp_port "$EXPECTED_IP" 80; then
  print_pass "TCP Port 80 (HTTP) is open and accepting connections."
  record_result "Port 80 Reachability" "PASS" "Open"
else
  print_fail "TCP Port 80 is CLOSED or TIMED OUT on $EXPECTED_IP." "Run 'sudo ufw allow 80/tcp && sudo ufw reload' on VPS. Let's Encrypt HTTP-01 requires port 80."
  record_result "Port 80 Reachability" "FAIL" "Port 80 closed / timed out"
fi

# Test Port 443
if test_tcp_port "$EXPECTED_IP" 443; then
  print_pass "TCP Port 443 (HTTPS) is open and accepting connections."
  record_result "Port 443 Reachability" "PASS" "Open"
else
  print_fail "TCP Port 443 is CLOSED or TIMED OUT on $EXPECTED_IP." "Run 'sudo ufw allow 443/tcp && sudo ufw reload' on VPS."
  record_result "Port 443 Reachability" "FAIL" "Port 443 closed / timed out"
fi

# ==============================================================================
# CHECK 3: SSL/TLS Certificate Inspection
# ==============================================================================
print_step "3/6" "SSL/TLS Certificate Chain & SNI Inspection"

SSL_DUMP=""
if command -v openssl &>/dev/null; then
  SSL_DUMP=$(echo | openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" -showcerts 2>&1 || true)
fi

if [[ -n "$SSL_DUMP" ]]; then
  CERT_SUBJECT=$(echo "$SSL_DUMP" | openssl x509 -noout -subject 2>/dev/null || true)
  CERT_ISSUER=$(echo "$SSL_DUMP" | openssl x509 -noout -issuer 2>/dev/null || true)
  CERT_DATES=$(echo "$SSL_DUMP" | openssl x509 -noout -dates 2>/dev/null || true)

  print_info "Certificate Subject: $CERT_SUBJECT"
  print_info "Certificate Issuer : $CERT_ISSUER"
  print_info "Validity Dates     : $(echo "$CERT_DATES" | tr '\n' ' ')"

  if echo "$CERT_ISSUER" | grep -qi "TRAEFIK DEFAULT CERT"; then
    print_fail "Server is serving 'TRAEFIK DEFAULT CERT' (Self-Signed fallback)." \
      "Let's Encrypt failed to provision. Ensure domain has 'https://' in Coolify, port 80 is open in UFW, and acme.json is chmod 600."
    record_result "SSL Certificate" "FAIL" "Traefik fallback self-signed cert served"
  elif echo "$CERT_ISSUER" | grep -qiE "Let's Encrypt|ZeroSSL|Cloudflare|GTS|Google"; then
    print_pass "Trusted Certificate verified! ($CERT_ISSUER)"
    record_result "SSL Certificate" "PASS" "$CERT_ISSUER"
  else
    # Test strict curl verification
    if curl -sI --max-time "$TIMEOUT_SECS" "https://$DOMAIN/" &>/dev/null; then
      print_pass "TLS Handshake verified by system trust store! ($CERT_ISSUER)"
      record_result "SSL Certificate" "PASS" "Trusted issuer: $CERT_ISSUER"
    else
      print_fail "Untrusted SSL Certificate or Handshake failure." "Ensure valid public CA certificate is provisioned."
      record_result "SSL Certificate" "FAIL" "Untrusted issuer ($CERT_ISSUER)"
    fi
  fi
else
  # Fallback to curl test if openssl not available
  if curl -sI --max-time "$TIMEOUT_SECS" "https://$DOMAIN/" &>/dev/null; then
    print_pass "SSL certificate validated successfully via curl."
    record_result "SSL Certificate" "PASS" "Validated"
  else
    print_fail "SSL Certificate validation failed via curl." "Check Traefik logs: docker logs coolify-proxy"
    record_result "SSL Certificate" "FAIL" "Validation failed"
  fi
fi

# ==============================================================================
# CHECK 4: HTTP to HTTPS Redirection
# ==============================================================================
print_step "4/6" "HTTP to HTTPS Redirection Check (Port 80 -> Port 443)"

HTTP_HEADER_DUMP=$(curl -sI --max-time "$TIMEOUT_SECS" "http://$DOMAIN/" 2>/dev/null || true)
HTTP_STATUS=$(echo "$HTTP_HEADER_DUMP" | head -n 1 | awk '{ print $2 }' || true)
REDIRECT_LOC=$(echo "$HTTP_HEADER_DUMP" | grep -i "^location:" | awk '{ print $2 }' | tr -d '\r\n' || true)

print_info "HTTP Status Code   : ${HTTP_STATUS:-None}"
print_info "Location Header    : ${REDIRECT_LOC:-None}"

if [[ "$HTTP_STATUS" =~ ^(301|302|307|308)$ ]] && [[ "$REDIRECT_LOC" =~ ^https:// ]]; then
  print_pass "HTTP correctly redirects to HTTPS ($HTTP_STATUS -> $REDIRECT_LOC)."
  record_result "HTTP->HTTPS Redirect" "PASS" "Status $HTTP_STATUS -> $REDIRECT_LOC"
elif [[ "$HTTP_STATUS" == "200" ]]; then
  print_warn "HTTP returned 200 OK without redirecting to HTTPS." "Enable Traefik redirect-to-https middleware in Coolify."
  record_result "HTTP->HTTPS Redirect" "WARN" "No redirect (Returned 200)"
else
  print_fail "HTTP request failed or returned unexpected status: ${HTTP_STATUS:-No response}" "Verify port 80 is open and Traefik 'web' entrypoint is active."
  record_result "HTTP->HTTPS Redirect" "FAIL" "Status ${HTTP_STATUS:-None}"
fi

# ==============================================================================
# CHECK 5: Application Health Endpoint (GET /api/health)
# ==============================================================================
print_step "5/6" "Application Health Check (GET https://$DOMAIN/api/health)"

# Perform standard HTTPS request
HEALTH_RAW=$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT_SECS" "https://$DOMAIN/api/health" 2>/dev/null || true)
HEALTH_CODE=$(echo "$HEALTH_RAW" | tail -n 1)
HEALTH_BODY=$(echo "$HEALTH_RAW" | sed '$d')

if [[ "$HEALTH_CODE" == "200" ]]; then
  print_pass "GET /api/health returned HTTP 200 OK!"
  print_info "Response Body      : $HEALTH_BODY"
  record_result "Healthcheck (/api/health)" "PASS" "HTTP 200: $HEALTH_BODY"
else
  print_info "Standard TLS request failed (HTTP Code: ${HEALTH_CODE:-Failed}). Testing with TLS bypass (-k)..."
  HEALTH_BYPASS_RAW=$(curl -k -s -w "\n%{http_code}" --max-time "$TIMEOUT_SECS" "https://$DOMAIN/api/health" 2>/dev/null || true)
  BYPASS_CODE=$(echo "$HEALTH_BYPASS_RAW" | tail -n 1)
  BYPASS_BODY=$(echo "$HEALTH_BYPASS_RAW" | sed '$d')

  if [[ "$BYPASS_CODE" == "503" ]]; then
    print_fail "Server returned HTTP 503 Service Unavailable." \
      "Traefik port mismatch! In Coolify application settings, change 'Ports Exposes' to 3000 and redeploy."
    record_result "Healthcheck (/api/health)" "FAIL" "HTTP 503 Service Unavailable (Port mismatch)"
  elif [[ "$BYPASS_CODE" == "200" ]]; then
    print_fail "Application is running (HTTP 200), but connection failed due to SSL Certificate error." \
      "Fix Let's Encrypt certificate. Set domain to 'https://$DOMAIN' and open port 80."
    record_result "Healthcheck (/api/health)" "FAIL" "SSL Certificate untrusted (App returns 200 behind proxy)"
  else
    print_fail "Healthcheck returned status ${BYPASS_CODE:-None}." "Check Next.js container logs on VPS: docker logs <container_name>"
    record_result "Healthcheck (/api/health)" "FAIL" "HTTP ${BYPASS_CODE:-None}"
  fi
fi

# ==============================================================================
# CHECK 6: LINE Webhook Verification Simulation (POST /api/webhooks/line)
# ==============================================================================
print_step "6/6" "LINE Webhook Verification Simulation (POST /api/webhooks/line)"

WEBHOOK_BODY='{"destination":"U00000000000000000000000000000000","events":[]}'

# Pre-flight check: HMAC-SHA256 requires openssl
if ! command -v openssl &>/dev/null; then
  print_warn "The 'openssl' command is not installed on this machine." \
    "HMAC-SHA256 signature generation requires 'openssl'. Skipping Check 6 to avoid sending an empty signature and reporting a confusing Channel Secret mismatch."
  print_info "To enable Check 6, install openssl (e.g. 'sudo apt-get install -y openssl' or 'brew install openssl')."
  record_result "LINE Webhook Verify" "WARN" "Skipped: 'openssl' not installed (required for HMAC-SHA256 signature)"
else
  SIG_HEADER=$(printf '%s' "$WEBHOOK_BODY" | openssl dgst -sha256 -hmac "$CHANNEL_SECRET" -binary | base64 | tr -d '\r\n')

  print_info "Generated Signature: ${SIG_HEADER:-None}"
  print_info "Payload Body       : $WEBHOOK_BODY"

  WEBHOOK_RAW=$(curl -s -w "\n%{http_code}" --max-time "$TIMEOUT_SECS" \
    -X POST "https://$DOMAIN/api/webhooks/line" \
    -H "Content-Type: application/json" \
    -H "x-line-signature: $SIG_HEADER" \
    -d "$WEBHOOK_BODY" 2>/dev/null || true)
  WEBHOOK_CODE=$(echo "$WEBHOOK_RAW" | tail -n 1)
  WEBHOOK_RESP=$(echo "$WEBHOOK_RAW" | sed '$d')

  if [[ "$WEBHOOK_CODE" == "200" ]]; then
    print_pass "LINE Webhook verification succeeded! Received HTTP 200 OK."
    print_info "Response Body      : $WEBHOOK_RESP"
    record_result "LINE Webhook Verify" "PASS" "HTTP 200 OK: $WEBHOOK_RESP"
  else
    print_info "Standard TLS request failed (HTTP Code: ${WEBHOOK_CODE:-Failed}). Testing with TLS bypass (-k)..."
    BYPASS_WH_RAW=$(curl -k -s -w "\n%{http_code}" --max-time "$TIMEOUT_SECS" \
      -X POST "https://$DOMAIN/api/webhooks/line" \
      -H "Content-Type: application/json" \
      -H "x-line-signature: $SIG_HEADER" \
      -d "$WEBHOOK_BODY" 2>/dev/null || true)
    BYPASS_WH_CODE=$(echo "$BYPASS_WH_RAW" | tail -n 1)
    BYPASS_WH_RESP=$(echo "$BYPASS_WH_RAW" | sed '$d')

    if [[ "$BYPASS_WH_CODE" == "200" ]]; then
      print_fail "Webhook logic is functional (HTTP 200), but LINE console will fail due to UNTRUSTED SSL." \
        "Resolve SSL certificate issue so LINE Developers Console can establish trusted TLS handshake."
      record_result "LINE Webhook Verify" "FAIL" "SSL untrusted (App logic returns 200)"
    elif [[ "$BYPASS_WH_CODE" == "503" ]]; then
      print_fail "LINE Webhook returned HTTP 503 Service Unavailable." \
        "Traefik cannot route to port 3000. Set 'Ports Exposes' to pure integer 3000 in Coolify and click Redeploy."
      record_result "LINE Webhook Verify" "FAIL" "HTTP 503 Service Unavailable"
    elif [[ "$BYPASS_WH_CODE" == "401" ]]; then
      print_fail "LINE Webhook returned HTTP 401 Unauthorized." \
        "Channel Secret mismatch! Verify LINE_CHANNEL_SECRET in Coolify matches LINE Developers Console."
      record_result "LINE Webhook Verify" "FAIL" "HTTP 401: Invalid signature"
    else
      print_fail "LINE Webhook returned status ${BYPASS_WH_CODE:-None}." "Check Next.js container logs on VPS: docker logs <container_name>"
      record_result "LINE Webhook Verify" "FAIL" "HTTP ${BYPASS_WH_CODE:-None}"
    fi
  fi
fi

# ==============================================================================
# SUMMARY SCOREBOARD & ACTIONABLE GUIDANCE
# ==============================================================================
print_header "DIAGNOSTIC SUMMARY SCOREBOARD"

ALL_PASS=1
for i in "${!RES_NAMES[@]}"; do
  NAME="${RES_NAMES[$i]}"
  STATUS="${RES_STATUS[$i]}"
  DETAILS="${RES_DETAILS[$i]}"
  
  if [[ "$STATUS" == "PASS" ]]; then
    echo -e "  $(printf '%-28s' "$NAME") : [${C_GREEN}${STATUS}${C_RESET} ] $DETAILS"
  elif [[ "$STATUS" == "WARN" ]]; then
    echo -e "  $(printf '%-28s' "$NAME") : [${C_YELLOW}${STATUS}${C_RESET} ] $DETAILS"
  else
    echo -e "  $(printf '%-28s' "$NAME") : [${C_RED}${STATUS}${C_RESET} ] $DETAILS"
    ALL_PASS=0
  fi
done

echo ""
if [[ "$ALL_PASS" -eq 1 ]]; then
  echo -e "${C_GREEN}================================================================================${C_RESET}"
  echo -e "${C_GREEN}  ALL CHECKS PASSED! LINE Webhook is ready for verification.${C_RESET}"
  echo -e "${C_GREEN}  Navigate to LINE Developers Console and click 'Verify' -> Expect 'Success'.${C_RESET}"
  echo -e "${C_GREEN}================================================================================${C_RESET}"
  exit 0
else
  echo -e "${C_RED}================================================================================${C_RESET}"
  echo -e "${C_RED}  ACTION REQUIRED: 1 or more critical checks failed.${C_RESET}"
  echo -e "${C_RED}  Please follow the steps in COOLIFY_VPS_SSL_RESOLUTION_GUIDE.md:${C_RESET}"
  echo -e "${C_YELLOW}    1. In Coolify: General -> Set 'Domains' to 'https://$DOMAIN'${C_RESET}"
  echo -e "${C_YELLOW}    2. In Coolify: General -> Set 'Ports Exposes' to pure integer '3000' (not 3000:3000)${C_RESET}"
  echo -e "${C_YELLOW}    3. On VPS: Run 'sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp' (safeguards SSH)${C_RESET}"
  echo -e "${C_YELLOW}    4. On VPS: Run 'sudo chmod 600 /data/coolify/proxy/acme.json'${C_RESET}"
  echo -e "${C_YELLOW}    5. In Coolify: Click 'Redeploy' (recreates container with updated labels; not just Restart)${C_RESET}"
  echo -e "${C_RED}================================================================================${C_RESET}"
  exit 1
fi
