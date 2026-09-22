# Deploying OrderStream

Target: a single VPS with **at least 4 GB RAM** (five JVMs plus Kafka plus Postgres). Hetzner CX22, DigitalOcean 4 GB or similar.

## 1. Prepare the server

```bash
ssh root@<SERVER_IP>

apt update && apt upgrade -y
apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx git
systemctl enable --now docker
```

## 2. Clone and configure

```bash
git clone <YOUR_REPO_URL> /opt/orderstream
cd /opt/orderstream
```

**Change the JWT secret before starting.** Generate one:

```bash
openssl rand -base64 48
```

Put the same value in both `auth-service/src/main/resources/application.yml` and `api-gateway/src/main/resources/application.yml` — or better, override it at runtime by adding to both services in `docker-compose.full.yml`:

```yaml
      ORDERSTREAM_JWT_SECRET: "<the generated value>"
```

Also set the gateway's allowed origin to the real domain:

```yaml
      ORDERSTREAM_CORS_ALLOWED-ORIGIN: https://<YOUR_DOMAIN>
```

## 3. Start the stack

The frontend is served by Vercel, so the server runs the backend only. Create `.env` next to the
compose files:

```bash
cd /opt/orderstream
cat > .env <<EOF
JWT_SECRET=$(openssl rand -base64 48)
CORS_ORIGINS=https://<your-domain>,https://www.<your-domain>
EOF
chmod 600 .env
```

`CORS_ORIGINS` takes a comma-separated list — the app answers on the apex and the www host.

```bash
docker compose -f docker-compose.full.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.full.yml -f docker-compose.prod.yml ps
```

All seven containers must show `Up`; the first build takes 5–10 minutes. The production overrides
add `restart: unless-stopped`, so the stack comes back on its own after a reboot.

## 4. Firewall and reverse proxy

The gateway and the WebSocket service listen on 8080 and 8084. Nothing but nginx should reach
them, so close everything else:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

Then put nginx in front:

```bash
cp infra/nginx.conf /etc/nginx/sites-available/orderstream
ln -s /etc/nginx/sites-available/orderstream /etc/nginx/sites-enabled/orderstream
rm -f /etc/nginx/sites-enabled/default
sed -i "s/api.example.com/api.<your-domain>/" /etc/nginx/sites-available/orderstream
nginx -t && systemctl reload nginx
```

## 5. Enable HTTPS

Point an A record at the server's IP first, then:

```bash
certbot --nginx -d <YOUR_DOMAIN>
```

Certbot rewrites the config for TLS. Verify the WebSocket block survived — it must still contain `proxy_set_header Upgrade $http_upgrade;`. If it did not, add it back and reload.

## 6. Verify

Open `https://<YOUR_DOMAIN>`:

1. The restaurant list loads
2. Register an account
3. Place an order
4. The status advances on its own within ~15 seconds — this confirms Kafka and the WebSocket both work through the proxy

## 7. Updating

```bash
cd /opt/orderstream
git pull
docker compose -f docker-compose.full.yml up --build -d
```

## Costs and alternatives

A 4 GB VPS runs about 5–7 EUR per month and this stack fits comfortably.

If the server is memory-constrained, move Kafka off the box to a managed service: [Confluent Cloud](https://www.confluent.io/confluent-cloud/tryfree/) gives new accounts free starting credit and bills on usage afterwards. Remove the `kafka` service from the compose file and point `SPRING_KAFKA_BOOTSTRAP_SERVERS` at the managed cluster, adding the SASL properties it gives you.

## Keeping it cheap

The demo has no real users. If the server is only needed while job hunting, `docker compose -f docker-compose.full.yml down` when it is not in use, or take screenshots and a screen recording for the README so the project stays presentable even after the server is gone.
