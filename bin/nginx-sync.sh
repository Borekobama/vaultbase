#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -f "${ROOT}/.env" ]; then set -a; . "${ROOT}/.env"; set +a; fi

domain="${NGINX_DOMAIN:-}"
port="${VAULTBASE_PORT:-12013}"
vhost_dir="${PANEL_VHOST_DIR:-/www/server/panel/vhost/nginx}"
nginx_bin="${NGINX_BIN:-/www/server/nginx/sbin/nginx}"
nginx_conf="${NGINX_CONF:-/www/server/nginx/conf/nginx.conf}"
[ -n "${domain}" ] || { echo "nginx-sync: NGINX_DOMAIN is not set; skipping."; exit 0; }
[ -d "${vhost_dir}" ] || { echo "nginx-sync: aaPanel not found; skipping."; exit 0; }
cert_dir="/www/server/panel/vhost/cert/${domain}"
[ -s "${cert_dir}/fullchain.pem" ] && [ -s "${cert_dir}/privkey.pem" ] || { echo "nginx-sync: issue the aaPanel certificate for ${domain} first; skipping."; exit 0; }
mkdir -p "${vhost_dir}/well-known" "${vhost_dir}/extension/${domain}"
touch "${vhost_dir}/well-known/${domain}.conf"
cat > "${vhost_dir}/${domain}.conf" <<EOF
# Managed by Vaultbase bin/nginx-sync.sh
server {
    listen 80;
    listen [::]:80;
    server_name ${domain};
    location ^~ /.well-known/acme-challenge/ { root /www/wwwroot/${domain}; }
    return 301 https://\$host\$request_uri;
}
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name ${domain};
    ssl_certificate ${cert_dir}/fullchain.pem;
    ssl_certificate_key ${cert_dir}/privkey.pem;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer always;
    client_max_body_size 2m;
    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_connect_timeout 15s;
        proxy_send_timeout 3600s;
        proxy_read_timeout 3600s;
        proxy_request_buffering off;
    }
    location ~ ^/(\.git|\.env|secrets|runtime) { return 404; }
    access_log /www/wwwlogs/${domain}.log;
    error_log /www/wwwlogs/${domain}.error.log;
}
EOF
"${nginx_bin}" -t -c "${nginx_conf}"
"${nginx_bin}" -s reload
echo "nginx-sync: ${domain} -> 127.0.0.1:${port}"
