export type InfraType = "dns" | "ssl" | "proxy" | "tunnel" | "monitor" | "alert";

export type InfraStatus = "pending" | "active" | "error" | "disabled";

export interface InfraProviderDef {
  id: string;
  type: InfraType;
  name: string;
  description: string;
  icon: string;
  color: string;
  docsUrl?: string;
  configFields: InfraConfigField[];
  credentialFields: InfraConfigField[];
}

export interface InfraConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "select" | "number";
  required: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
}

export interface InfraConfig {
  id: string;
  userId: string;
  projectId: string | null;
  machineId: string | null;
  type: InfraType;
  adapter: string;
  name: string;
  domain: string | null;
  status: InfraStatus;
  config: Record<string, unknown>;
  credentials: Record<string, string>;
  lastChecked: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InfraHealthCheck {
  id: string;
  configId: string;
  status: "ok" | "degraded" | "down" | "unknown";
  latency: number | null;
  message: string | null;
  checkedAt: string;
}

export const INFRA_PROVIDERS: InfraProviderDef[] = [
  // ── DNS ──
  {
    id: "cloudflare", type: "dns",
    name: "Cloudflare DNS", description: "Cloudflare API — upravljanje DNS zapisima",
    icon: "☁", color: "orange",
    docsUrl: "https://developers.cloudflare.com/api/",
    configFields: [
      { key: "zone_id", label: "Zone ID", type: "text", required: true, placeholder: "abc123def" },
    ],
    credentialFields: [
      { key: "api_token", label: "API Token", type: "password", required: true },
    ],
  },
  {
    id: "route53", type: "dns",
    name: "AWS Route53", description: "Amazon Route53 — hosted zone management",
    icon: "🟠", color: "yellow",
    docsUrl: "https://docs.aws.amazon.com/Route53/",
    configFields: [
      { key: "hosted_zone_id", label: "Hosted Zone ID", type: "text", required: true },
      { key: "region", label: "Region", type: "text", required: false, placeholder: "us-east-1" },
    ],
    credentialFields: [
      { key: "access_key_id", label: "Access Key ID", type: "text", required: true },
      { key: "secret_access_key", label: "Secret Access Key", type: "password", required: true },
    ],
  },
  {
    id: "namecheap", type: "dns",
    name: "Namecheap", description: "Namecheap API — DNS management for domains",
    icon: "🟢", color: "green",
    docsUrl: "https://www.namecheap.com/support/api/intro/",
    configFields: [
      { key: "domain", label: "Domain", type: "text", required: true, placeholder: "example.com" },
    ],
    credentialFields: [
      { key: "api_user", label: "API User", type: "text", required: true },
      { key: "api_key", label: "API Key", type: "password", required: true },
      { key: "client_ip", label: "Client IP", type: "text", required: true },
    ],
  },
  {
    id: "porkbun", type: "dns",
    name: "Porkbun", description: "Porkbun API — jednostavni DNS management",
    icon: "🐷", color: "pink",
    docsUrl: "https://porkbun.com/api/json/v3/documentation",
    configFields: [
      { key: "domain", label: "Domain", type: "text", required: true, placeholder: "example.com" },
    ],
    credentialFields: [
      { key: "api_key", label: "API Key", type: "password", required: true },
      { key: "secret_api_key", label: "Secret API Key", type: "password", required: true },
    ],
  },

  // ── SSL ──
  {
    id: "lets-encrypt", type: "ssl",
    name: "Let's Encrypt", description: "ACME protokol — besplatni SSL sertifikati",
    icon: "🔒", color: "green",
    docsUrl: "https://letsencrypt.org/docs/",
    configFields: [
      { key: "email", label: "Email za ACME", type: "text", required: true, placeholder: "admin@example.com" },
      { key: "domains", label: "Domeni (zarez odvojeni)", type: "text", required: true, placeholder: "example.com,www.example.com" },
    ],
    credentialFields: [],
  },
  {
    id: "custom-cert", type: "ssl",
    name: "Custom Certificate", description: "Ručni unos — privatni ključ + cert chain",
    icon: "📜", color: "blue",
    configFields: [
      { key: "cert_name", label: "Naziv certifikata", type: "text", required: true },
    ],
    credentialFields: [
      { key: "private_key", label: "Privatni ključ", type: "password", required: true },
      { key: "fullchain", label: "Full chain cert", type: "password", required: true },
    ],
  },

  // ── Proxy ──
  {
    id: "nginx", type: "proxy",
    name: "Nginx", description: "Nginx reverse proxy — site configs, SSL termination",
    icon: "🟦", color: "green",
    docsUrl: "https://nginx.org/en/docs/",
    configFields: [
      { key: "domain", label: "Domain", type: "text", required: true, placeholder: "example.com" },
      { key: "upstream_port", label: "Upstream port", type: "number", required: true, placeholder: "3000" },
      { key: "ssl_enabled", label: "SSL", type: "select", required: false, options: [{ label: "Enabled", value: "true" }, { label: "Disabled", value: "false" }] },
    ],
    credentialFields: [],
  },
  {
    id: "caddy", type: "proxy",
    name: "Caddy", description: "Caddy server — auto SSL, jednostavan config",
    icon: "🎩", color: "yellow",
    docsUrl: "https://caddyserver.com/docs/",
    configFields: [
      { key: "domain", label: "Domain", type: "text", required: true, placeholder: "example.com" },
      { key: "upstream_port", label: "Upstream port", type: "number", required: true, placeholder: "3000" },
    ],
    credentialFields: [],
  },
  {
    id: "traefik", type: "proxy",
    name: "Traefik", description: "Traefik — auto service discovery, Docker integracija",
    icon: "🔺", color: "red",
    docsUrl: "https://doc.traefik.io/traefik/",
    configFields: [
      { key: "domain", label: "Domain", type: "text", required: true, placeholder: "example.com" },
      { key: "entrypoint", label: "EntryPoint", type: "text", required: false, placeholder: "websecure" },
    ],
    credentialFields: [],
  },

  // ── Tunnel ──
  {
    id: "tailscale", type: "tunnel",
    name: "Tailscale", description: "WireGuard-based mesh VPN — secure tunnel",
    icon: "🦎", color: "blue",
    docsUrl: "https://tailscale.com/kb/",
    configFields: [
      { key: "hostname", label: "Hostname", type: "text", required: true, placeholder: "myserver" },
    ],
    credentialFields: [
      { key: "auth_key", label: "Auth Key", type: "password", required: true },
    ],
  },
  {
    id: "wireguard", type: "tunnel",
    name: "WireGuard", description: "VPN tunnel — peer-to-peer, minimal config",
    icon: "🔀", color: "purple",
    docsUrl: "https://www.wireguard.com/",
    configFields: [
      { key: "endpoint", label: "Endpoint", type: "text", required: true, placeholder: "vpn.example.com:51820" },
      { key: "allowed_ips", label: "Allowed IPs", type: "text", required: true, placeholder: "10.0.0.0/24" },
    ],
    credentialFields: [
      { key: "private_key", label: "Private Key", type: "password", required: true },
      { key: "public_key", label: "Public Key", type: "text", required: true },
    ],
  },
  {
    id: "cloudflare-tunnel", type: "tunnel",
    name: "Cloudflare Tunnel", description: "Argo Tunnel / Cloudflare Tunnel — no open ports",
    icon: "☁", color: "orange",
    docsUrl: "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/",
    configFields: [
      { key: "tunnel_name", label: "Tunnel Name", type: "text", required: true, placeholder: "my-tunnel" },
    ],
    credentialFields: [
      { key: "token", label: "Tunnel Token", type: "password", required: true },
    ],
  },
  {
    id: "ngrok", type: "tunnel",
    name: "ngrok", description: "Public URL za localhost — instant tunnel",
    icon: "🌀", color: "blue",
    docsUrl: "https://ngrok.com/docs",
    configFields: [
      { key: "domain", label: "Domain (optional)", type: "text", required: false, placeholder: "myapp.ngrok.io" },
      { key: "port", label: "Local port", type: "number", required: true, placeholder: "3000" },
    ],
    credentialFields: [
      { key: "authtoken", label: "Authtoken", type: "password", required: true },
    ],
  },

  // ── Monitor ──
  {
    id: "http-monitor", type: "monitor",
    name: "HTTP Monitor", description: "HTTP(S) uptime — status code, response time, content check",
    icon: "🌐", color: "green",
    configFields: [
      { key: "url", label: "URL", type: "text", required: true, placeholder: "https://example.com/health" },
      { key: "expected_status", label: "Expected status", type: "number", required: false, placeholder: "200" },
      { key: "interval", label: "Interval (seconds)", type: "number", required: false, placeholder: "60" },
      { key: "timeout", label: "Timeout (seconds)", type: "number", required: false, placeholder: "10" },
    ],
    credentialFields: [],
  },
  {
    id: "tcp-monitor", type: "monitor",
    name: "TCP Monitor", description: "TCP port check — da li port sluša",
    icon: "🔌", color: "blue",
    configFields: [
      { key: "host", label: "Host", type: "text", required: true, placeholder: "example.com" },
      { key: "port", label: "Port", type: "number", required: true, placeholder: "443" },
      { key: "interval", label: "Interval (seconds)", type: "number", required: false, placeholder: "60" },
    ],
    credentialFields: [],
  },
  {
    id: "ping-monitor", type: "monitor",
    name: "Ping Monitor", description: "ICMP ping — basic reachability",
    icon: "📶", color: "purple",
    configFields: [
      { key: "target", label: "Target (IP or hostname)", type: "text", required: true, placeholder: "192.168.1.1" },
      { key: "interval", label: "Interval (seconds)", type: "number", required: false, placeholder: "120" },
    ],
    credentialFields: [],
  },

  // ── Alert ──
  {
    id: "email-alert", type: "alert",
    name: "Email Alert", description: "Slanje emaila na incident",
    icon: "📧", color: "blue",
    configFields: [
      { key: "recipient", label: "Email recipient", type: "text", required: true, placeholder: "admin@example.com" },
    ],
    credentialFields: [],
  },
  {
    id: "slack-alert", type: "alert",
    name: "Slack Alert", description: "Slack webhook notifikacija",
    icon: "💬", color: "green",
    configFields: [],
    credentialFields: [
      { key: "webhook_url", label: "Webhook URL", type: "password", required: true },
    ],
  },
  {
    id: "discord-alert", type: "alert",
    name: "Discord Alert", description: "Discord webhook notifikacija",
    icon: "🎮", color: "purple",
    configFields: [],
    credentialFields: [
      { key: "webhook_url", label: "Webhook URL", type: "password", required: true },
    ],
  },
  {
    id: "telegram-alert", type: "alert",
    name: "Telegram Alert", description: "Telegram bot notifikacija",
    icon: "✈", color: "blue",
    configFields: [
      { key: "chat_id", label: "Chat ID", type: "text", required: true, placeholder: "-1001234567890" },
    ],
    credentialFields: [
      { key: "bot_token", label: "Bot Token", type: "password", required: true },
    ],
  },
];

export function getProvidersByType(type: InfraType): InfraProviderDef[] {
  return INFRA_PROVIDERS.filter((p) => p.type === type);
}

export function getProvider(id: string): InfraProviderDef | undefined {
  return INFRA_PROVIDERS.find((p) => p.id === id);
}

export const TYPE_META: Record<InfraType, { label: string; icon: string; color: string; description: string }> = {
  dns: { label: "DNS", icon: "🌐", color: "blue", description: "DNS provideri i DNS record management" },
  ssl: { label: "SSL", icon: "🔒", color: "green", description: "SSL/TLS certifikati — Let's Encrypt, Custom" },
  proxy: { label: "Proxy", icon: "↔", color: "orange", description: "Reverse proxy — Nginx, Caddy, Traefik" },
  tunnel: { label: "Tunnel", icon: "🔀", color: "purple", description: "Tuneliranje — Tailscale, WireGuard, CF Tunnel, ngrok" },
  monitor: { label: "Monitor", icon: "📊", color: "red", description: "Uptime monitoring — HTTP, TCP, Ping" },
  alert: { label: "Alert", icon: "🔔", color: "yellow", description: "Incident notifikacije — Email, Slack, Discord, Telegram" },
};
