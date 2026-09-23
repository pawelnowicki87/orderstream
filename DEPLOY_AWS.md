# Deploying OrderStream to Vercel + a single EC2 instance

The browser app is served by Vercel; the five services, Postgres and Kafka all run in Docker on
one small EC2 instance behind nginx. This is the layout the live demo actually runs on.

```
Vercel (static Angular)
   │  HTTPS                                   ▲ WSS
   ▼                                          │
              nginx on api.orderstream.pl ────┘
   │  /api/ → :8080                 /ws → :8084
   ▼
api-gateway ──┬── auth-service
              ├── restaurant-service ◄── gRPC ── order-service ──┐ publishes
              └── order-service                                  ▼
                                                    Kafka (topic: order-events)
PostgreSQL: auth_db · restaurant_db · order_db                   │ consumes
                                                    notification-service
```

Only nginx is reachable from the internet. The security group opens 22, 80 and 443 and nothing
else, so 8080, 8084 and 5432 stay private even though Docker publishes them on the host. That is
what makes the "gateway validates the JWT and downstream services trust `X-User-Id`" design
defensible.

## Sizing and cost

`t4g.small` — 2 vCPU Graviton, 2 GB RAM — in `eu-central-1`:

| | per month |
|---|---|
| t4g.small | $14.02 |
| 20 GB gp3 | $1.90 |
| Elastic IP | $3.65 |
| **Total** | **$19.57** |

ARM is safe here: `protoc 3.25.5` and `protoc-gen-grpc-java 1.68.1` both publish
`linux-aarch_64` binaries, so the gRPC build works unchanged.

**2 GB is not enough with the default JVM settings.** Measured on the running stack:

| | default heaps | after `docker-compose.prod.yml` |
|---|---|---|
| containers, anonymous memory | 1 583 MiB | 1 275 MiB |
| whole system | 2 187 MB | 1 565 MB |

`docker-compose.prod.yml` caps each JVM at 144 MB with SerialGC and a bounded metaspace, drops
Kafka from its 1 GB default heap to 224 MB, and shrinks Postgres' shared buffers. A 2 GB swapfile
absorbs the peaks. C2 is deliberately left on — the tracking page advertises a Kafka-to-browser
latency in the tens of milliseconds, and interpreting the hot path would show up there.

**Build on a bigger instance.** Compiling five Spring Boot services will not fit in 2 GB. Launch
as `t4g.medium`, build, then stop the instance, `modify-instance-attribute --instance-type
Value=t4g.small` and start it again. The EBS volume and the Elastic IP both survive, so it costs
a few cents and about two minutes.

## 1. The instance

```bash
AMI=$(aws ssm get-parameter --region eu-central-1 \
  --name /aws/service/canonical/ubuntu/server/24.04/stable/current/arm64/hvm/ebs-gp3/ami-id \
  --query Parameter.Value --output text)

aws ec2 import-key-pair --key-name orderstream --public-key-material fileb://~/.ssh/orderstream.pub

SG=$(aws ec2 create-security-group --group-name orderstream-sg \
  --description "OrderStream demo" --vpc-id <default-vpc> --query GroupId --output text)
aws ec2 authorize-security-group-ingress --group-id $SG --protocol tcp --port 22  --cidr <your-ip>/32
aws ec2 authorize-security-group-ingress --group-id $SG --protocol tcp --port 80  --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SG --protocol tcp --port 443 --cidr 0.0.0.0/0

aws ec2 run-instances --image-id $AMI --instance-type t4g.medium \
  --key-name orderstream --security-group-ids $SG \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":20,"VolumeType":"gp3"}}]'
```

Attach an Elastic IP. Without one the public address changes on every stop/start, which breaks
both DNS and the certificate the moment you resize the instance.

## 2. The host

```bash
sudo apt-get install -y ca-certificates curl git nginx certbot python3-certbot-nginx
# Docker from the official repository, then:
sudo usermod -aG docker ubuntu

sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 3. The stack

```bash
git clone https://github.com/pawelnowicki87/orderstream.git /opt/orderstream
cd /opt/orderstream
cat > .env <<ENV
JWT_SECRET=$(openssl rand -base64 48)
CORS_ORIGINS=https://<your-vercel-app>.vercel.app,https://<your-domain>
ENV
chmod 600 .env

docker compose -f docker-compose.full.yml -f docker-compose.prod.yml up -d --build
```

Build the five services one at a time; parallel builds will exhaust the box.

## 4. nginx and TLS

Point an A record at the Elastic IP first, then:

```bash
sudo cp infra/nginx.conf /etc/nginx/sites-available/orderstream
sudo sed -i "s/api.example.com/api.<your-domain>/" /etc/nginx/sites-available/orderstream
sudo ln -sf /etc/nginx/sites-available/orderstream /etc/nginx/sites-enabled/orderstream
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d api.<your-domain> --redirect
```

**Check the WebSocket block after certbot runs.** Certbot rewrites the file to add the TLS
listener, and if `proxy_set_header Upgrade $http_upgrade;` does not survive, the STOMP handshake
fails silently and live tracking never updates. Verify with:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" -H "Sec-WebSocket-Version: 13" \
  https://api.<your-domain>/ws
```

`101` is the answer you want. `400` means the upgrade headers were lost.

## 5. The frontend on Vercel

Root Directory `frontend`, then two variables:

```
API_BASE_URL = https://api.<your-domain>
WS_URL       = wss://api.<your-domain>/ws
```

Both are read at build time by `scripts/generate-env.mjs`, so changing them means redeploying.
Unlike a two-host setup, REST and the WebSocket share one origin here — nginx routes `/api/` and
`/ws` to different containers.

## 6. Verify

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://api.<your-domain>/api/restaurants   # 200
curl -s -D- -o /dev/null -H "Origin: https://<your-vercel-app>.vercel.app" \
  https://api.<your-domain>/api/restaurants | grep -i access-control-allow-origin
```

Then open the site, use "Try the demo", place an order and watch the tracking page: the status
must advance on its own and the event log must show the Kafka and WebSocket lines sharing a
timestamp.

## 7. Shutting it down

Stopping the instance does **not** stop the bill — the EBS volume and the Elastic IP keep
charging. To stop paying entirely, terminate the instance and **release the Elastic IP**; AWS
bills unattached addresses separately.
