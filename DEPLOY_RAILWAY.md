# Deploying OrderStream to Vercel + Railway

The cheap layout: the browser app is served by Vercel, the five services run on Railway,
and the two stateful pieces are pushed onto services that are free or nearly free.

```
Vercel (static Angular)
   │  REST over HTTPS                        ▲ WSS
   ▼                                         │
api-gateway  ── public domain                notification-service ── public domain
   │  private network (*.railway.internal)   ▲
   ├── auth-service                          │ consumes
   ├── restaurant-service ◄── gRPC ── order-service ──┘ publishes
   │                                         │
Neon (auth_db · restaurant_db · order_db)    Redpanda (Kafka API)
```

Only two Railway services get a public domain. Everything else talks over the private network
and is unreachable from the internet, which is what makes the "gateway validates the JWT and
downstream services trust `X-User-Id`" design defensible.

## Why this shape

Railway bills actual memory and CPU by the second — about **$10 per GB-month** and **$20 per
vCPU-month** — and does not charge for the number of services. Three things drive the bill down:

| Decision | Saving | Cost to the project |
|---|---|---|
| Redpanda instead of Kafka (one native process, not a JVM) | ~$7/mo | none, same wire protocol |
| Postgres on Neon free tier instead of a Railway container | ~$3/mo | none |
| `-Xmx192m` + SerialGC on each service | ~$5/mo | none at demo traffic |

That lands the whole stack around **$20/month of usage**, which the Pro plan's included $20
credit covers. Packing the services into one container would *not* help: you pay for the memory
the JVMs use, not for how many containers hold them.

**Railway Serverless (app sleeping) will not work here.** It detects idleness from outbound
traffic, and the docs list open database connections as something that keeps a service awake.
HikariCP pools, the Kafka consumer poll loop and `OrderProgressSimulator` all keep traffic
flowing, so nothing would ever sleep.

---

## 1. Postgres on Neon

1. Create a project at <https://neon.tech> — the free tier scales to zero and is plenty here.
2. Create three databases: `auth_db`, `restaurant_db`, `order_db`.
3. From the connection details take the host, user and password. The JDBC URL for each service is:

```
jdbc:postgresql://<neon-host>/auth_db?sslmode=require
```

Neon suspends an idle database and takes roughly half a second to wake it. Fine for a demo;
the first request after a quiet night is just slow, not broken.

## 2. Redpanda on Railway

New project → **Deploy from Docker image** → `redpandadata/redpanda:latest`. Name the service
`redpanda`, leave it without a public domain, and set the start command:

```
redpanda start --node-id 0 --mode dev-container --smp 1 --memory 512M --check=false --kafka-addr PLAINTEXT://0.0.0.0:9092 --advertise-kafka-addr PLAINTEXT://redpanda.railway.internal:9092
```

**Untested detail, check it first:** Railway's private network is IPv6. If the services cannot
reach the broker at `redpanda.railway.internal:9092`, change the two addresses to
`PLAINTEXT://[::]:9092` and redeploy. The symptom is `Connection to node -1 could not be
established` in order-service's logs.

## 3. The five Java services

For each one: **New service → GitHub repo → this repository**, then in *Settings*:

- **Root Directory** — the service folder (`auth-service`, `restaurant-service`, …)
- **Builder** — Dockerfile (Railway picks up the `Dockerfile` already in each folder)
- **Public Networking** — generate a domain **only** for `api-gateway` and `notification-service`

Railway injects `PORT` into services that have a domain; every `application.yml` already reads
`${PORT:…}`, so nothing else is needed for that.

### Shared variable

Set on all five services:

```
JAVA_TOOL_OPTIONS = -Xmx192m -XX:MaxMetaspaceSize=128m -XX:+UseSerialGC -Xss256k
```

### Per service

**auth-service**
```
SPRING_DATASOURCE_URL      = jdbc:postgresql://<neon-host>/auth_db?sslmode=require
SPRING_DATASOURCE_USERNAME = <neon-user>
SPRING_DATASOURCE_PASSWORD = <neon-password>
ORDERSTREAM_JWT_SECRET     = <openssl rand -base64 48>
```

**restaurant-service**
```
SPRING_DATASOURCE_URL      = jdbc:postgresql://<neon-host>/restaurant_db?sslmode=require
SPRING_DATASOURCE_USERNAME = <neon-user>
SPRING_DATASOURCE_PASSWORD = <neon-password>
```
If order-service cannot reach it over gRPC, add `GRPC_SERVER_ADDRESS = ::` here — the server
binds every interface by default, but Railway's IPv6-only private network can need it spelled out.

**order-service**
```
SPRING_DATASOURCE_URL                    = jdbc:postgresql://<neon-host>/order_db?sslmode=require
SPRING_DATASOURCE_USERNAME               = <neon-user>
SPRING_DATASOURCE_PASSWORD               = <neon-password>
SPRING_KAFKA_BOOTSTRAP_SERVERS           = redpanda.railway.internal:9092
GRPC_CLIENT_RESTAURANT-SERVICE_ADDRESS   = static://restaurant-service.railway.internal:9090
ORDERSTREAM_DEMO_ADVANCE-INTERVAL-MS     = 15000
```

**notification-service**
```
SPRING_KAFKA_BOOTSTRAP_SERVERS = redpanda.railway.internal:9092
```

**api-gateway**
```
ORDERSTREAM_JWT_SECRET            = <the same secret as auth-service, byte for byte>
ORDERSTREAM_SERVICES_AUTH         = http://auth-service.railway.internal:8081
ORDERSTREAM_SERVICES_RESTAURANT   = http://restaurant-service.railway.internal:8082
ORDERSTREAM_SERVICES_ORDER        = http://order-service.railway.internal:8083
ORDERSTREAM_CORS_ALLOWED-ORIGIN   = https://<your-project>.vercel.app
```

The internal services keep their default ports because Railway only injects `PORT` where a
domain exists — that is why the three URLs above are explicit about 8081/8082/8083.

Deploy in this order so nothing starts against a missing dependency: redpanda → auth,
restaurant → order, notification → gateway.

## 4. The frontend on Vercel

New project → import this repository → **Root Directory: `frontend`**. `frontend/vercel.json`
already sets the build command and the SPA fallback, so only the two variables are left:

```
API_BASE_URL = https://<api-gateway>.up.railway.app
WS_URL       = wss://<notification-service>.up.railway.app/ws
```

They are read at build time by `scripts/generate-env.mjs`, which writes
`src/environments/environment.prod.ts`. Changing a URL means redeploying, not just restarting.

Once Vercel gives you the real domain, put it into the gateway's `ORDERSTREAM_CORS_ALLOWED-ORIGIN`
and redeploy that service. Until then every browser request fails on CORS, which looks like a
broken backend but is not one.

The WebSocket goes **straight to Railway**, not through Vercel — Vercel's rewrites do not carry
WebSocket connections, so there is no point routing `/ws` through it.

## 5. Verify

1. Open the Vercel URL — ten restaurants with photos
2. Register an account, open a restaurant, place an order
3. The tracking page must say *Live*, and the status must advance on its own within ~15 s

If step 3 stalls, check in this order: `notification-service` logs for `Received … for order …`
(no lines means Redpanda is not reachable), then the browser network tab for a `101 Switching
Protocols` on `/ws` (missing means `WS_URL` is wrong or the domain is not public).

## 6. Watching the bill

Railway's usage page breaks the cost down per service. Expect roughly 250–300 MB per Java
service at rest. If a service is noticeably fatter, its heap flag did not apply — check that
`JAVA_TOOL_OPTIONS` is set on that service and look for `Picked up JAVA_TOOL_OPTIONS` in its
deploy logs.

When the demo is not needed, remove the public domains or pause the project; Neon and Vercel
cost nothing while idle.
