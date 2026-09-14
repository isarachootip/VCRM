# Master Operator Resolution Guide: Resolving SSL (`SEC_E_UNTRUSTED_ROOT`) and HTTP 503 on Coolify VPS

**Target Domain**: `https://vcrmx.online`  
**Target VPS IP**: `187.77.147.16`  
**Target Endpoint**: `POST https://vcrmx.online/api/webhooks/line`  
**Application Stack**: Next.js 14 Standalone (`0.0.0.0:3000`) + Prisma PostgreSQL (`187.77.147.16:5433`)  
**Infrastructure**: Linux VPS running Coolify v4 PaaS with Traefik Reverse Proxy  
**Document Version**: 1.0.0 (Production Grade)  
**Date**: 2026-09-13  

---

## Table of Contents
1. [Executive Summary & Architecture Flow](#1-executive-summary--architecture-flow)
2. [Dual Root Cause Analysis](#2-dual-root-cause-analysis)
   - [2.1 Issue A: SSL Certificate Failure (`SEC_E_UNTRUSTED_ROOT`)](#21-issue-a-ssl-certificate-failure-sec_e_untrusted_root)
   - [2.2 Issue B: HTTP 503 Service Unavailable](#22-issue-b-http-503-service-unavailable)
3. [Environment & Configuration Inventory](#3-environment--configuration-inventory)
4. [Action Track 1: Coolify Web UI Dashboard Remediation](#4-action-track-1-coolify-web-ui-dashboard-remediation)
5. [Action Track 2: Linux VPS SSH Terminal Playbook](#5-action-track-2-linux-vps-ssh-terminal-playbook)
6. [Action Track 3: Traefik Let's Encrypt Troubleshooting & Force-Renewal](#6-action-track-3-traefik-lets-encrypt-troubleshooting--force-renewal)
7. [Action Track 4: LINE Developers Console Webhook Verification](#7-action-track-4-line-developers-console-webhook-verification)
8. [Action Track 5: Emergency Fallback Alternatives](#8-action-track-5-emergency-fallback-alternatives)
9. [Automated Diagnostic & Verification Tool Suite](#9-automated-diagnostic--verification-tool-suite)
10. [Comprehensive Troubleshooting Matrix & FAQ](#10-comprehensive-troubleshooting-matrix--faq)

---

## 1. Executive Summary & Architecture Flow

When an external client (browser, `curl`, or the LINE Developers Console) sends an HTTPS request to `https://vcrmx.online/api/webhooks/line`, two sequential failures currently prevent the request from succeeding:

```
[LINE Console / Browser / Client]
               │
               ▼
   [DNS: vcrmx.online] ──► Resolves to 187.77.147.16
               │
               ▼
[VPS Inbound TCP Port 443] ──► Traefik Reverse Proxy
               │
   ┌───────────┴────────────────────────────────────────┐
   │ 1. TLS Handshake: Is a valid Let's Encrypt cert    │
   │    stored in Traefik's /traefik/acme.json?         │
   └───────────┬────────────────────────────────────────┘
              / \
            NO   YES ──► Handshake OK
            /
           ▼
[FAIL 1: SSL FAILURE]
Traefik falls back to "CN=TRAEFIK DEFAULT CERT" (Self-Signed)
Client throws: SEC_E_UNTRUSTED_ROOT (0x80090325) / SSL certificate problem
Connection terminated!
           │
           ▼ (If TLS error is bypassed via curl -k)
   ┌────────────────────────────────────────────────────┐
   │ 2. HTTP Routing: Traefik routes Host(`vcrmx.online`)│
   │    Checks Load Balancer pool for healthy backends  │
   └───────────┬────────────────────────────────────────┘
              / \
            NO   YES ──► Forwards to Next.js container (Port 3000)
            /
           ▼
[FAIL 2: 503 SERVICE UNAVAILABLE]
Coolify defaults "Ports Exposes" to 80. Traefik attempts connection to <container_ip>:80.
Next.js listens ONLY on port 3000 (TCP connection refused).
Backend pool has 0 available servers.
Traefik returns: HTTP 503 Service Unavailable ("No server available for service")
```

Both failures must be resolved in tandem:
1. **SSL Resolution**: Configure domain with `https://` prefix in Coolify and open TCP port 80 in VPS firewall so Traefik can complete the Let's Encrypt ACME HTTP-01 challenge.
2. **503 Resolution**: Set Coolify "Ports Exposes" to `3000` so Traefik forwards traffic to the port where Next.js is actively listening (`0.0.0.0:3000`).

---

## 2. Dual Root Cause Analysis

### 2.1 Issue A: SSL Certificate Failure (`SEC_E_UNTRUSTED_ROOT`)
- **Observed Behavior**: `curl https://vcrmx.online` throws:
  ```text
  schannel: SEC_E_UNTRUSTED_ROOT (0x80090325) - The certificate chain was issued by an authority that is not trusted.
  curl: (60) schannel: SEC_E_UNTRUSTED_ROOT
  ```
- **Technical Mechanism**:
  1. Traefik includes a built-in default self-signed fallback certificate (`CN=TRAEFIK DEFAULT CERT`).
  2. Traefik serves this certificate whenever it does not have a matching valid certificate in `/traefik/acme.json` for the requested SNI hostname (`vcrmx.online`).
  3. Operating system trust stores (Windows Schannel, Linux ca-certificates) and external API gateways (LINE Messaging API Webhook engine) strictly reject self-signed certificates.
- **Why Let's Encrypt Failed to Provision**:
  - **Reason 1 (Firewall Blocking Port 80)**: Let's Encrypt HTTP-01 challenge requires ACME verification servers to connect to `http://vcrmx.online/.well-known/acme-challenge/<TOKEN>` on **TCP port 80**. If the Linux VPS firewall (`ufw` or cloud security group) drops or blocks inbound port 80, the ACME challenge times out.
  - **Reason 2 (Coolify Domain Syntax)**: In Coolify v4, Traefik dynamic labels are generated from the "Domains" input field. If the operator entered `vcrmx.online` or `http://vcrmx.online` without `https://`, Coolify does **not** attach `traefik.http.routers.<app>-https.tls.certresolver=letsencrypt`. As a result, Traefik never requests an SSL certificate from Let's Encrypt.
  - **Reason 3 (`acme.json` Permissions)**: Traefik requires strict POSIX permissions `0600` (`-rw-------`) on `/data/coolify/proxy/acme.json`. If permissions are too open (e.g. `0644` or `0777`), Traefik refuses to use the file and logs `permissions are too open: 0644`.

### 2.2 Issue B: HTTP 503 Service Unavailable
- **Observed Behavior**: `curl -k -I https://vcrmx.online/` returns:
  ```http
  HTTP/2 503
  content-type: text/plain; charset=utf-8
  server: Traefik

  Service Unavailable
  ```
- **Technical Mechanism**:
  1. The response header `server: Traefik` proves that the 503 is returned by Traefik's reverse proxy, **not** by Next.js or Node.js.
  2. In Traefik architecture, `HTTP 503 Service Unavailable` is generated when a router successfully matches a request rule (`Host(`vcrmx.online`)`), but the associated service load balancer pool has **0 healthy server instances**.
- **Why the Backend Pool is Empty**:
  - **Reason 1 (Port Mismatch - Primary Culprit)**:
    - The Next.js production build (`Dockerfile` lines 40–44) explicitly configures:
      ```dockerfile
      EXPOSE 3000
      ENV PORT=3000
      ENV HOSTNAME="0.0.0.0"
      CMD ["node", "server.js"]
      ```
    - The Node.js application listens **only on port 3000**.
    - Coolify's application configuration defaults "Ports Exposes" to `80` if left blank.
    - This instructs Traefik to route traffic to `http://<container_ip>:80`. Traefik attempts TCP connection to port 80, receives `connection refused` (TCP RST), marks the backend container dead, and returns 503.
  - **Reason 2 (Container Exited / Crash Loop)**:
    - If the container failed during startup (e.g., failed to connect to PostgreSQL at `187.77.147.16:5433` or crashed due to missing required environment variables), Docker marks the container status as `Exited (1)`. Traefik detects container exit and removes it from the routing pool.
  - **Reason 3 (Docker Network Isolation)**:
    - Traefik (`coolify-proxy`) lives on the Docker network named `coolify`.
    - If the application container is deployed on an isolated network without bridge attachment to `coolify`, Traefik cannot route packets to the container IP.

---

## 3. Environment & Configuration Inventory

Ensure the following configuration values are prepared before proceeding:

| Configuration Item | Expected Production Value | Purpose |
|---|---|---|
| **Domain FQDN** | `https://vcrmx.online` | Instructs Coolify to generate HTTPS router + Let's Encrypt certresolver |
| **Exposed Port** | `3000` | Matches Next.js internal listening port (`ENV PORT=3000`) |
| **Container Host Binding** | `0.0.0.0` | Ensures Next.js listens on all container network interfaces |
| **Node Environment** | `production` | Enables Next.js production optimizations |
| **Database URL** | `postgresql://postgres:49VYfH6Q3mc5BRj3FFKYA4j2v7Ya2pA13G9em2FE0rHCeLIZKnpmpY8YOW25ZO6H@187.77.147.16:5433/postgres?schema=public` | PostgreSQL database on VPS port 5433 |
| **LINE Channel Secret** | `f40ae1f3b30c2c02ceaa22f04a86e582` | Used to compute HMAC-SHA256 signature for webhook verification |
| **LINE Channel Access Token** | `LXrnZAwtSTtebDLg3x/+5z8rXrSiOXTQMWMt68zn74tLm/bQOeNYzByQdOPs8rbhMKhTYasa+K/CKZjamIj9JhvqhXCKJXtH/I2YjgGpTkaYpqOLPlp6Ely/r3TWlc3CXDuRypg1+xcfo5g4clIDOgdB04t89/1O/w1cDnyilFU=` | Used for outbound reply messages |
| **LINE Bot Basic ID** | `@596vuzmi` | Channel Identifier |
| **Health Check Path** | `/api/health` | Lightweight endpoint returning `{"status":"healthy"}` |

---

## 4. Action Track 1: Coolify Web UI Dashboard Remediation

Execute these steps in the Coolify Web Dashboard:

### Step 1.1: Log in and Locate the Application
1. Open your browser and navigate to your Coolify instance (e.g. `http://187.77.147.16:8000` or your Coolify management domain).
2. Enter your administrator credentials.
3. In the left navigation sidebar, click **Projects**.
4. Click on your project (e.g. **VCRM** or **Default**), then click the **Environment** (e.g. **production**).
5. Click on the **VCRM Application** card to enter its configuration screen.

### Step 1.2: Configure the Domain (Fixes SSL)
1. On the application details page, select the **General** / **Configuration** tab.
2. Locate the **Domains** input field.
3. **CRITICAL**: Enter:
   ```text
   https://vcrmx.online
   ```
   > ⚠️ **IMPORTANT**: You **MUST** include the `https://` prefix.  
   > - If you enter `vcrmx.online` without `https://`, Coolify will only configure an HTTP (port 80) router and will NOT request a Let's Encrypt certificate.  
   > - The `https://` prefix is what triggers Coolify to inject `traefik.http.routers.<app>-https.tls.certresolver=letsencrypt`.

### Step 1.3: Configure Ports Exposes (Fixes 503)
1. In the same **General** configuration section, locate **Ports Exposes**.
2. Change the value from `80` (or blank) to:
   ```text
   3000
   ```
   > ⚠️ **CRITICAL PORT SYNTAX WARNING (PURE INTEGER ONLY)**:
   > - You **MUST enter pure integer `3000`**.
   > - **DO NOT** enter Docker port mapping syntax like `3000:3000`, `0.0.0.0:3000`, or `80:3000`.
   > - Coolify directly injects this string into Traefik's `traefik.http.services.<app>.loadbalancer.server.port` label. If you enter `3000:3000`, Traefik fails to parse the value as a numeric port, silently drops the service routing definition, and **HTTP 503 Service Unavailable will persist**.
   > - The Next.js standalone container listens internally on port `3000` (`Dockerfile` lines 40–44). Leaving this field as `80` causes Traefik to route to port 80, resulting in `TCP connection refused` and `HTTP 503 Service Unavailable`.

### Step 1.4: Set Environment Variables
1. Click the **Environment Variables** tab for the application.
2. Ensure the following environment variables are present and set:

   ```env
   PORT=3000
   HOSTNAME=0.0.0.0
   NODE_ENV=production
   DATABASE_URL=postgresql://postgres:49VYfH6Q3mc5BRj3FFKYA4j2v7Ya2pA13G9em2FE0rHCeLIZKnpmpY8YOW25ZO6H@187.77.147.16:5433/postgres?schema=public
   LINE_CHANNEL_SECRET=f40ae1f3b30c2c02ceaa22f04a86e582
   LINE_CHANNEL_ACCESS_TOKEN=LXrnZAwtSTtebDLg3x/+5z8rXrSiOXTQMWMt68zn74tLm/bQOeNYzByQdOPs8rbhMKhTYasa+K/CKZjamIj9JhvqhXCKJXtH/I2YjgGpTkaYpqOLPlp6Ely/r3TWlc3CXDuRypg1+xcfo5g4clIDOgdB04t89/1O/w1cDnyilFU=
   LINE_BOT_BASIC_ID=@596vuzmi
   ```

   > 💡 **NOTE**: The Next.js multi-stage `Dockerfile` only copies `.next/standalone`. Any local `line_config.json` is not present in the runtime container. The application relies **100% on environment variables** to read the LINE Channel Secret and Access Token.

3. Click **Save** to persist the environment variables.

### Step 1.5: Configure Application Health Check
1. In the application settings, navigate to **Health Checks**.
2. Configure:
   - **Health Check Path**: `/api/health`
   - **Expected Status Code**: `200`
   - **Interval**: `30s`
   - **Timeout**: `5s`
   - **Retries**: `3`
   - **Start Period**: `30s` (allows Next.js time to compile/boot before health probes begin)
   *(Alternatively, if troubleshooting deployment instability, toggle health check OFF temporarily until container is confirmed healthy).*

### Step 1.6: Verify Server ACME Email in Coolify
1. In Coolify's left sidebar, click **Servers** → click **localhost** (or your VPS server card).
2. Click **Proxy** tab (Traefik).
3. Verify that **Let's Encrypt Email** is set to a valid email address (e.g. `admin@vcrmx.online` or your administrator email). Let's Encrypt requires a valid email for ACME account registration.
4. Click **Save** if modified.

### Step 1.7: Trigger Redeployment (Crucial: Redeploy vs Restart)
> 🚨 **CRITICAL RULE: REDEPLOY vs RESTART**:
> In Docker architecture, **container labels are strictly immutable** once a container is instantiated.
> - Modifying "Domains" (`https://vcrmx.online`) or "Ports Exposes" (`3000`) in the Coolify Web UI **only mutates Coolify's database records**.
> - Clicking **Restart** (or running `docker restart <container>` in SSH) merely boots the existing container with its **OLD labels** (e.g. port 80 without SSL resolver). Traefik continues routing according to the old container labels, causing the 503 error or SSL untrusted root to persist!
> - You **MUST click Redeploy** (or **Deploy**). This instructs Coolify to recreate the container from scratch, embedding the new Traefik routing labels (`server.port=3000`, `certresolver=letsencrypt`) into the new Docker container.

1. Return to **Projects** → Application.
2. Click the orange/green **Deploy** or **Redeploy** button in the top-right corner.
3. Click on the active deployment log to monitor progress:
   - Verify that the Docker build completes (`npm ci`, `npx prisma generate`, `npm run build`).
   - Verify that the container starts up and reports `Listening on port 3000`.
   - Verify that Coolify prints: `Labels successfully updated for Traefik`.

---

## 5. Action Track 2: Linux VPS SSH Terminal Playbook

Connect to your Linux VPS via SSH to inspect and configure the system:

```bash
ssh root@187.77.147.16
```

### Step 2.1: Configure UFW Firewall (Mandatory for Let's Encrypt HTTP-01)
Let's Encrypt ACME verification servers MUST reach TCP port 80. Run:

> 🚨 **CRITICAL OPERATOR SAFETY SAFEGUARD (SSH LOCKOUT PREVENTION)**:
> If UFW is currently `inactive` and you enable it without allowing your SSH port, **YOU WILL BE PERMANENTLY LOCKED OUT** of your VPS terminal session!
> - Always explicitly permit SSH port `22/tcp` (or your operator's active SSH port if customized) **BEFORE enabling or reloading UFW**.
> - The command below explicitly prepends `sudo ufw allow 22/tcp` to guarantee continued remote access.

```bash
# 1. Check current firewall status
sudo ufw status verbose

# 2. CRITICAL PRE-REQUISITE: Allow SSH FIRST to prevent catastrophic lockout!
# If your SSH port is customized (e.g. 2222), change 22 to your active SSH port:
sudo ufw allow 22/tcp comment "SSH administration safeguard"

# 3. Allow inbound HTTP (Port 80) and HTTPS (Port 443)
sudo ufw allow 80/tcp comment "Let's Encrypt ACME HTTP-01 challenge"
sudo ufw allow 443/tcp comment "Traefik HTTPS entrypoint"

# 4. Reload UFW rules (or enable safely if previously inactive)
sudo ufw reload
# Note: If UFW was inactive, enable it safely now:
# sudo ufw --force enable

# 5. Verify rules are active and SSH is explicitly permitted
sudo ufw status verbose | grep -E '22/tcp|80/tcp|443/tcp'
```
*Expected Output*:
```text
22/tcp                     ALLOW IN    Anywhere                   # SSH administration safeguard
80/tcp                     ALLOW IN    Anywhere                   # Let's Encrypt ACME HTTP-01 challenge
443/tcp                    ALLOW IN    Anywhere                   # Traefik HTTPS entrypoint
```

> ⚠️ **Cloud Provider Security Groups**: If your VPS is hosted on Hetzner, AWS, DigitalOcean, Linode, or OVH, also verify the **Cloud Security Group** in the provider's web console allows inbound TCP traffic on ports 80 and 443 from `0.0.0.0/0`.

### Step 2.2: Inspect and Fix `acme.json` Permissions
Traefik refuses to read or write certificates if `acme.json` permissions are too permissive:

```bash
# 1. Inspect acme.json file permissions
ls -la /data/coolify/proxy/acme.json

# 2. If permissions are NOT -rw------- (0600), fix immediately:
sudo chmod 600 /data/coolify/proxy/acme.json
sudo chown root:root /data/coolify/proxy/acme.json

# 3. Confirm permissions are now 600 (-rw-------)
ls -la /data/coolify/proxy/acme.json
```

### Step 2.3: Inspect Traefik Proxy Status and Logs
Check what Traefik is doing with `vcrmx.online`:

```bash
# 1. Confirm coolify-proxy container is up and running
docker ps --filter "name=coolify-proxy"

# 2. View recent Traefik logs for ACME Let's Encrypt activity
docker logs --tail 200 coolify-proxy 2>&1 | grep -iE 'acme|letsencrypt|certificate|vcrmx'

# 3. View recent Traefik logs for 503 errors and routing issues
docker logs --tail 200 coolify-proxy 2>&1 | grep -iE '503|no server available|router'
```

### Step 2.4: Inspect VCRM Application Container and Docker Network (Coolify v4 UUID Discovery)
Confirm the Next.js container is healthy and connected to the `coolify` network:

> 💡 **Coolify v4 Container Naming Note**:
> In Coolify v4, application containers are assigned **UUID-based generated names** (such as `g8w4k4ss8sc0s8skgwck8k88-0191eb9c2794`), NOT literal strings like `crm` or `vcrm`.
> To accurately identify your application container, filter by the `coolify` Docker network, Coolify management labels, or port `3000`.

```bash
# 1. View all running containers connected to the 'coolify' network:
docker ps --filter "network=coolify" --format "table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}"

# 2. Robust automated discovery of the VCRM application container:
# Prioritizes containers connected to network 'coolify' exposing port 3000, or labeled by Coolify
VCRM_CONTAINER=$(docker ps --filter "network=coolify" --format '{{.Names}} {{.Ports}} {{.Image}}' | grep -iE '3000|vcrm|crm|next' | awk '{print $1}' | head -n 1)

# Fallback A: If empty, search by coolify.managed label (excluding infrastructure containers)
if [ -z "$VCRM_CONTAINER" ]; then
  VCRM_CONTAINER=$(docker ps --filter "label=coolify.managed=true" --format "{{.Names}}" | grep -vE 'coolify-proxy|coolify-db|coolify-redis' | head -n 1)
fi

# Fallback B: If still empty, display all active containers for manual selection
if [ -z "$VCRM_CONTAINER" ]; then
  echo "⚠️ Automatic discovery did not match a unique container. Available containers:"
  docker ps --format "table {{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
  echo "Select your container name and run: export VCRM_CONTAINER=<container_name>"
else
  echo "✅ Identified VCRM container: $VCRM_CONTAINER"
fi

# 3. Check container status (must show Up, not Exited or Restarting)
if [ -n "$VCRM_CONTAINER" ]; then
  docker ps --filter "name=$VCRM_CONTAINER" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

  # 4. Check application logs for runtime errors
  docker logs --tail 100 "$VCRM_CONTAINER"

  # 5. Verify the container is attached to the 'coolify' Docker network
  docker network inspect coolify --format '{{range .Containers}}{{.Name}} -> {{.IPv4Address}}{{"\n"}}{{end}}' | grep "$VCRM_CONTAINER"

  # 6. If the container is NOT connected to 'coolify', attach it:
  docker network connect coolify "$VCRM_CONTAINER" 2>/dev/null || true

  # 7. Test direct HTTP reachability from inside coolify-proxy to the container on port 3000
  VCRM_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$VCRM_CONTAINER" | head -n 1)
  echo "Testing container connectivity at http://${VCRM_IP}:3000/api/health"
  docker exec coolify-proxy wget -qO- --timeout=5 "http://${VCRM_IP}:3000/api/health"
else
  echo "❌ Error: No container selected. Set VCRM_CONTAINER manually."
fi
```
*Expected Output for Step 7*:
```json
{"status":"healthy","service":"crm-nextjs","timestamp":"..."}
```
If this command returns the JSON response, the Next.js container is healthy and listening properly on port 3000.

---

## 6. Action Track 3: Traefik Let's Encrypt Troubleshooting & Force-Renewal

If Traefik cached a failed challenge or continues serving `CN=TRAEFIK DEFAULT CERT`, perform a clean ACME certificate renewal:

### Step 3.1: Inspect Existing Certificates in `acme.json`
In Coolify v4, `/data/coolify/proxy/acme.json` is a **SHARED GLOBAL FILE** holding certificates for ALL hosted applications, databases, and Coolify itself. Before modifying it, inspect what certificates exist:

```bash
# 1. View all active certificate domains in acme.json:
if command -v jq &>/dev/null; then
  sudo jq -r '.. | .Certificates? // empty | .[] | .domain' /data/coolify/proxy/acme.json 2>/dev/null
else
  sudo grep -E '"main":|"domain":' /data/coolify/proxy/acme.json
fi

# 2. Check if a certificate entry for vcrmx.online exists:
sudo grep -A 10 -B 2 "vcrmx.online" /data/coolify/proxy/acme.json || echo "No certificate entry found for vcrmx.online."
```

### Step 3.2: Safe Non-Destructive Certificate Renewal (Multi-Tenant Hardened)

> 🚨 **CRITICAL MULTI-TENANT WARNING**:
> - `/data/coolify/proxy/acme.json` contains SSL certificates for **ALL domains hosted on this VPS**.
> - **DO NOT** execute a global file wipe (`echo "{}" > acme.json`) on a shared VPS! Doing so will instantly revoke SSL certificates for every application on the server, causing widespread outages and triggering Let's Encrypt rate limits when Traefik attempts bulk re-issuance.
> - Always create a timestamped backup, and selectively prune **ONLY** `vcrmx.online`.

#### Substep 1: Create a Timestamped Backup
Always create a timestamped backup before touching `acme.json`:
```bash
sudo cp /data/coolify/proxy/acme.json /data/coolify/proxy/acme.json.bak.$(date +%s)
```

#### Substep 2: Option A (Recommended) — Selective Removal of `vcrmx.online` ONLY
Use Python (universal on Linux VPS distributions) or `jq` to remove solely `vcrmx.online`, preserving all other hosted domains:

**Method 1: Selective Removal with Python (Universal on Linux)**
```bash
sudo python3 -c '
import json, sys

path = "/data/coolify/proxy/acme.json"
target_domain = "vcrmx.online"

try:
    with open(path, "r") as f:
        data = json.load(f)
except Exception as e:
    print(f"Error reading {path}: {e}")
    sys.exit(1)

pruned_count = 0
def prune(obj):
    global pruned_count
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "Certificates" and isinstance(v, list):
                original_len = len(v)
                obj[k] = [
                    cert for cert in v
                    if cert.get("domain", {}).get("main") != target_domain
                    and target_domain not in cert.get("domain", {}).get("sans", [])
                ]
                pruned_count += original_len - len(obj[k])
            else:
                prune(v)

prune(data)

with open(path, "w") as f:
    json.dump(data, f, indent=2)

print(f"Done: Removed {pruned_count} certificate entries for {target_domain}. Other domain certificates preserved.")
'
sudo chmod 600 /data/coolify/proxy/acme.json
```

**Method 2: Selective Removal with `jq` (Alternative)**
If `jq` is installed on your VPS:
```bash
sudo jq --arg domain "vcrmx.online" '
  walk(
    if type == "object" and has("Certificates") and (.Certificates | type == "array") then
      .Certificates |= map(select((.domain.main != $domain) and ((.domain.sans // []) | index($domain) | not)))
    else . end
  )
' /data/coolify/proxy/acme.json > /tmp/acme.json.tmp && \
sudo mv /tmp/acme.json.tmp /data/coolify/proxy/acme.json && \
sudo chmod 600 /data/coolify/proxy/acme.json
```

#### Substep 3: Option B (HIGH RISK) — Global Reset (Single-Domain Dedicated VPS Only!)
> ⛔ **HIGH RISK NOTICE**:
> The command below wipes ALL certificates across the entire server.
> Use this **ONLY** if this VPS is a dedicated, single-domain server running exclusively `vcrmx.online` and `acme.json` is irreversibly corrupted.
>
> ```bash
> # ⚠️ DANGER: ONLY RUN ON A DEDICATED SINGLE-DOMAIN SERVER!
> sudo bash -c 'echo "{}" > /data/coolify/proxy/acme.json'
> sudo chmod 600 /data/coolify/proxy/acme.json
> ```

#### Substep 4: Restart Traefik Proxy and Monitor ACME Issuance
After updating `acme.json`:
```bash
# 1. Restart coolify-proxy to reload configuration and trigger immediate ACME challenge
docker restart coolify-proxy

# 2. Monitor live Traefik logs during the ACME challenge
docker logs -f coolify-proxy 2>&1 | grep -iE 'acme|certificate|vcrmx'
```

*What to Look for in Logs*:
- ✅ **Success**: `Certificates obtained for domains [vcrmx.online]`
- ❌ **Port 80 Failure**: `Cannot obtain certificates... timeout ... /.well-known/acme-challenge/` (Indicates VPS port 80 is blocked by cloud firewall)
- ❌ **Rate Limit**: `429 urn:ietf:params:acme:error:rateLimited` (Too many failed attempts within 1 hour; see Fallback Section 8)

---

## 7. Action Track 4: LINE Developers Console Webhook Verification

Once SSL and port routing are active, configure and verify the webhook in the LINE Developers Console:

### Step 4.1: Access LINE Developers Console
1. Open [LINE Developers Console](https://developers.line.biz/console/).
2. Log in with your LINE Business Account.
3. Under **Providers**, select the provider owning your official account.
4. Click on your **Messaging API** channel.

### Step 4.2: Configure Webhook Settings
1. Click the **Messaging API** tab.
2. Scroll down to the **Webhook settings** section.
3. Configure the following:
   - **Webhook URL**: Click **Edit**, enter:
     ```text
     https://vcrmx.online/api/webhooks/line
     ```
     Click **Update**.
   - **Use webhook**: Toggle the switch to **ON** (Enabled).

### Step 4.3: Execute Verification
1. Click the **Verify** button next to the Webhook URL.
2. **Expected Result**: A green dialog pop-up displaying:
   ```text
   Success
   ```
   HTTP Status received by LINE: `200 OK`.

### Step 4.4: Webhook Response Mechanics & PostgreSQL Database Dependency Warning

Here is how `src/app/api/webhooks/line/route.ts` differentiates between the Verify ping and real chat events:

#### 1. LINE Developers Console "Verify" Ping (Empty Events Array)
- When you click **Verify**, LINE sends an HTTP `POST` request with signature header `x-line-signature` and an empty events payload:
  ```json
  {"destination":"U00000000000000000000000000000000","events":[]}
  ```
- If `LINE_CHANNEL_SECRET` is configured in Coolify, the server validates the HMAC-SHA256 signature.
- Because `events.length === 0`, execution exits at line 120 immediately:
  ```typescript
  // src/app/api/webhooks/line/route.ts:119-121
  if (events.length === 0) {
    return NextResponse.json({ message: 'Webhook verified successfully' }, { status: 200 });
  }
  ```
- **No database connection is required** for the Verify button to succeed! LINE console will display **Success**.

#### 2. Real Customer Messages (`events.length > 0` Requires Active PostgreSQL!)
> 🚨 **CRITICAL WARNING: DATABASE DEPENDENCY FOR LIVE CUSTOMER TRAFFIC**:
> - A green "Success" modal on the LINE Developers Console **DOES NOT** guarantee that customer chat messages will succeed!
> - When a real customer sends a message on LINE OA, LINE dispatches a webhook with `events.length > 0`.
> - The webhook handler (`src/app/api/webhooks/line/route.ts` lines 124–278) immediately executes Prisma database operations:
>   - Queries customer profile: `prisma.customer.findFirst(...)`
>   - Creates or updates customer record: `prisma.customer.create(...)`
>   - Creates customer Case / Opportunity: `prisma.case.create(...)`
>   - Saves message record: `prisma.message.create(...)`
> - **If PostgreSQL (`187.77.147.16:5433`) is unreachable, down, firewalled, or has bad credentials**:
>   - The LINE Console "Verify" button will STILL report **Success (HTTP 200)**!
>   - But when real customers send messages, the endpoint will crash with **HTTP 500 Internal Server Error** (`PrismaClientInitializationError: Can't reach database server at 187.77.147.16:5433`).
>   - The customer will experience silence (no bot replies, no agent assignment).

#### 3. Operational Pre-Flight Check for Database Connectivity
Before announcing production readiness to users:
1. Verify `DATABASE_URL` in Coolify Application Environment Variables:
   ```text
   postgresql://postgres:49VYfH6Q3mc5BRj3FFKYA4j2v7Ya2pA13G9em2FE0rHCeLIZKnpmpY8YOW25ZO6H@187.77.147.16:5433/postgres?schema=public
   ```
2. Test database port connectivity from the host terminal:
   ```bash
   nc -z -w 3 187.77.147.16 5433 && echo "✅ PostgreSQL port 5433 is reachable"
   ```
3. Test with a live mobile LINE client: Send a test message "hello" to LINE Official Account `@596vuzmi`, and immediately verify container logs on the VPS:
   ```bash
   docker logs --tail 30 "$VCRM_CONTAINER"
   ```
   Confirm you see successful case ingestion (`Created Case ...`) rather than `PrismaClientInitializationError`.

### Step 4.5: Troubleshooting LINE Verification Errors
- **Error: "An error occurred when sending the webhook." (SSL Issue)**:
  - Cause: Certificate is still self-signed (`TRAEFIK DEFAULT CERT`).
  - Fix: Check Step 5 & 6 above. Let's Encrypt certificate must be provisioned.
- **Error: "Server returned HTTP 503"**:
  - Cause: Coolify "Ports Exposes" is not `3000` or container is stopped.
  - Fix: Check Step 4.3 above. Set port to pure integer `3000` and click **Redeploy**.
- **Error: "Server returned HTTP 401"**:
  - Cause: Invalid `x-line-signature`. The `LINE_CHANNEL_SECRET` in Coolify environment variables does not match the Channel Secret of this LINE channel.
  - Fix: Copy the Channel Secret from the **Basic settings** tab of the LINE Developers Console and paste it into `LINE_CHANNEL_SECRET` in Coolify, then click **Redeploy**.
- **Error: Verify button shows "Success", but real chat messages fail with HTTP 500**:
  - Cause: PostgreSQL database at `187.77.147.16:5433` is down, blocked by firewall, or `DATABASE_URL` credentials are invalid. Verify ping never hits DB, but chat events require Prisma.
  - Fix: Verify PostgreSQL is running on port 5433, verify `DATABASE_URL` environment variable, and check `docker logs --tail 100 "$VCRM_CONTAINER"`.

---

## 8. Action Track 5: Emergency Fallback Alternatives

If Let's Encrypt HTTP-01 challenges are rate-limited or port 80 cannot be opened on the VPS:

### Fallback Option A: Cloudflare Proxy ("Orange Cloud") with Full (Strict) SSL
If the domain `vcrmx.online` DNS is hosted on Cloudflare:

> 💡 **Architectural Note (Orange Cloud vs Direct Traefik ACME)**:
> - **Direct Traefik Let's Encrypt (Track 1 & 2)**: Requires DNS to be **DNS only (Grey Cloud)** so Let's Encrypt validation servers reach your VPS port 80 directly. If Orange Cloud is enabled, Cloudflare intercepts HTTP-01 challenge requests, preventing Traefik from obtaining a certificate.
> - **Cloudflare Edge SSL (This Fallback)**: By turning on **Proxied (Orange Cloud)**, Cloudflare issues its own trusted Edge Certificate (Google Trust Services / Let's Encrypt) directly to clients. The client terminates SSL at Cloudflare's edge, completely resolving `SEC_E_UNTRUSTED_ROOT` for browsers and LINE Developers Console in under 60 seconds without requiring Traefik to have a certificate.

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Select domain `vcrmx.online` → **DNS** → **Records**.
3. Edit the `A` record for `vcrmx.online` (`187.77.147.16`):
   - Change **Proxy status** from **DNS only (Grey Cloud)** to **Proxied (Orange Cloud)**.
4. In the left menu, navigate to **SSL/TLS** → **Overview**:
   - Set encryption mode to **Full** (or **Full (Strict)** if Traefik has an origin cert).
   - In **Full** mode, Cloudflare issues its own trusted edge certificate to clients (browsers and LINE Developers Console) while connecting over TLS to Traefik on port 443.
5. In **SSL/TLS** → **Edge Certificates**:
   - Ensure **Always Use HTTPS** is enabled.
   - Minimum TLS Version: **TLS 1.2**.
6. **Result**: Immediate resolution of `SEC_E_UNTRUSTED_ROOT` within 60 seconds without waiting for Let's Encrypt.

### Fallback Option B: Traefik DNS-01 Challenge via Cloudflare API Token
If Port 80 cannot be opened on the VPS due to ISP restrictions:
1. In Cloudflare, generate an API Token with `Zone.DNS:Edit` permissions for `vcrmx.online`.
2. In Coolify, navigate to **Servers** → **localhost** → **Proxy** → **Configuration**.
3. Configure Traefik environment variables:
   ```env
   CF_DNS_API_TOKEN=your_cloudflare_api_token_here
   ```
4. Update the Traefik certificate resolver to use `dnsChallenge`:
   ```yaml
   certificatesResolvers:
     letsencrypt:
       acme:
         dnsChallenge:
           provider: cloudflare
           resolvers:
             - "1.1.1.1:53"
             - "8.8.8.8:53"
   ```
5. Restart Traefik proxy. Let's Encrypt will verify ownership via TXT record, bypassing port 80 entirely.

---

## 9. Automated Diagnostic & Verification Tool Suite

Two automated diagnostic scripts are included in the repository to evaluate all 6 stages of the resolution.

### Script 1: PowerShell Diagnostic Tool (`scripts/verify-coolify-ssl.ps1`)
Runs on Windows PowerShell (v5.1+) and PowerShell Core (v7+ on Windows/macOS/Linux).

#### Usage:
```powershell
# Run all standard checks
powershell -ExecutionPolicy Bypass -File scripts\verify-coolify-ssl.ps1

# Run with custom parameters
powershell -ExecutionPolicy Bypass -File scripts\verify-coolify-ssl.ps1 `
  -Domain "vcrmx.online" `
  -ExpectedIp "187.77.147.16" `
  -ChannelSecret "f40ae1f3b30c2c02ceaa22f04a86e582" `
  -VerboseOutput
```

### Script 2: Bash Diagnostic Tool (`scripts/verify-coolify-ssl.sh`)
Runs on Linux, macOS, WSL, and Git Bash.

#### Usage:
```bash
chmod +x scripts/verify-coolify-ssl.sh

# Run all standard checks
./scripts/verify-coolify-ssl.sh

# Run with custom parameters
./scripts/verify-coolify-ssl.sh --domain vcrmx.online --ip 187.77.147.16 --secret f40ae1f3b30c2c02ceaa22f04a86e582
```

### What the Diagnostic Scripts Test:
1. **Check 1: DNS Resolution**: Verifies `A` record matches `187.77.147.16`, queries `NS`, and checks for conflicting `AAAA` (IPv6) records.
2. **Check 2: TCP Connectivity**: Probes ports `80` (HTTP) and `443` (HTTPS) to verify firewall accessibility.
3. **Check 3: TLS/SSL Certificate Inspection**: Handshakes over TLS to inspect Subject, Issuer, Expiration Date, and SANs. Fails if issuer contains `TRAEFIK DEFAULT CERT`.
4. **Check 4: HTTP to HTTPS Redirection**: Checks that `http://vcrmx.online/` returns a `301` or `308` redirect to `https://`.
5. **Check 5: Application Healthcheck (`/api/health`)**: Sends a GET request and asserts HTTP 200 with JSON payload containing `healthy`.
6. **Check 6: LINE Webhook Verification Simulation (`/api/webhooks/line`)**: Computes genuine HMAC-SHA256 signature for `{"events":[]}` using the Channel Secret, sends `POST` request, and verifies `HTTP 200 OK`.

---

## 10. Comprehensive Troubleshooting Matrix & FAQ

| Symptom / Error | Root Cause | Exact Remediation Command or Action |
|---|---|---|
| `SEC_E_UNTRUSTED_ROOT (0x80090325)` | Traefik serves fallback self-signed certificate | 1. Set domain in Coolify to `https://vcrmx.online`<br>2. On VPS run `sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw reload`<br>3. Restart `coolify-proxy` |
| `HTTP 503 Service Unavailable` | Port mismatch (Traefik routing to 80 instead of 3000) | In Coolify Application → Configuration → General, set **Ports Exposes** to pure integer `3000` (DO NOT type `3000:3000`), then click **Redeploy** (not just Restart). |
| `HTTP 503 Service Unavailable` | Next.js container exited or crashed | SSH to VPS, run `docker logs "$VCRM_CONTAINER"`, verify database connection string in `DATABASE_URL`. |
| `LINE Webhook Verify = Success (200), but Live Chats Fail (500)` | Database unreachable or credentials invalid | Verify ping sends `events: []` (no DB needed). Live chats require PostgreSQL at `187.77.147.16:5433`. Verify DB port is open and `DATABASE_URL` is correct. |
| `HTTP 401 Unauthorized` on LINE webhook | Incorrect LINE Channel Secret | Ensure `LINE_CHANNEL_SECRET` in Coolify environment variables matches the channel secret in LINE Developers Console, then click **Redeploy**. |
| `HTTP 405 Method Not Allowed` on `/api/webhooks/line` | Sending GET instead of POST | LINE Webhook only accepts HTTP `POST`. Use `curl -X POST`. |
| `Cannot obtain certificates: acme: error: 429` | Let's Encrypt hourly rate limit exceeded | Wait 60 minutes, or switch Cloudflare proxy to **Proxied (Orange Cloud)** with **Full SSL**. |
| `acme.json permissions are too open: 0644` | Insecure file permissions | Run `sudo chmod 600 /data/coolify/proxy/acme.json` and restart `coolify-proxy`. |
| `dial tcp <ip>:3000: connect: no route to host` | Container not on `coolify` network | Ensure container is attached to network: `docker network connect coolify "$VCRM_CONTAINER"`. |

---

## 11. Final Acceptance Checklist

Before declaring the deployment verified:

- [ ] `Resolve-DnsName vcrmx.online` returns `187.77.147.16`.
- [ ] `Test-NetConnection 187.77.147.16 -Port 80` returns `TcpTestSucceeded: True`.
- [ ] `Test-NetConnection 187.77.147.16 -Port 443` returns `TcpTestSucceeded: True`.
- [ ] `curl.exe -Iv https://vcrmx.online/` connects cleanly without `SEC_E_UNTRUSTED_ROOT` and shows Let's Encrypt / ZeroSSL issuer.
- [ ] `curl.exe https://vcrmx.online/api/health` returns `HTTP 200` with `{"status":"healthy"}`.
- [ ] `scripts/verify-coolify-ssl.ps1` runs with all 6 checks marked **PASS**.
- [ ] LINE Developers Console Webhook URL `https://vcrmx.online/api/webhooks/line` Verify button displays **Success**.
