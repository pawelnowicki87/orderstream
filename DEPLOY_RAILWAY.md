# Deploying OrderStream to Vercel + Railway

The browser app is served by Vercel; the five services, Postgres and Kafka all run on Railway.
This is the layout the live demo actually runs on.

```
Vercel (static Angular)
   │  REST over HTTPS                        ▲ WSS
   ▼                                         │
api-gateway  ── public domain                notification-service ── public domain
   │  private network (*.railway.internal)   ▲
   ├── auth-service                          │ consumes
   ├── restaurant-service ◄── gRPC ── order-service ──┘ publishes
   │                                         │
Postgres (auth_db · restaurant_db · order_db)  Kafka (topic: order-events)
```

Only two Railway services get a public domain. Everything else talks over the private network
and is unreachable from the internet, which is what makes the "gateway validates the JWT and
downstream services trust `X-User-Id`" design defensible.

## Why this shape

Railway bills actual memory and CPU by the second — about **$10 per GB-month** and **$20 per
vCPU-month** — and does not charge for the number of services. Three things drive the bill down:

| Decision | Effect |
|---|---|
| `-Xmx192m` + SerialGC on each service | ~300 MB per service instead of ~450 MB |
| Kafka heap capped at 384 MB | the broker fits in ~600 MB |
| One Postgres instance, three databases | one billed service instead of three |

That lands the whole stack around **$20–25 of usage per month**, most of which the Pro plan's
included $20 credit covers. Packing the services into one container would *not* help: you pay for
the memory the JVMs use, not for how many containers hold them.

**Railway Serverless (app sleeping) will not work here.** It detects idleness from outbound
traffic, and the docs list open database connections as something that keeps a service awake.
HikariCP pools, the Kafka consumer poll loop and `OrderProgressSimulator` all keep traffic
flowing, so nothing would ever sleep.

---

## 1. Postgres

```bash
railway init --name orderstream
railway add --database postgres
```

Railway's Postgres starts with a single database called `railway`. Create the three the services
expect — `railway ssh` runs the command inside the container, so the database stays off the public
internet:

```bash
railway ssh --service Postgres createdb -U postgres auth_db
railway ssh --service Postgres createdb -U postgres restaurant_db
railway ssh --service Postgres createdb -U postgres order_db
```

Quoting does not survive `railway ssh`, which is why this uses `createdb` rather than `psql -c`.

## 2. Kafka

```bash
railway add --service kafka --image apache/kafka:3.9.0 \n  --variables "KAFKA_NODE_ID=1" \n  --variables "KAFKA_PROCESS_ROLES=broker,controller" \n  --variables "KAFKA_LISTENERS=PLAINTEXT://[::]:9092,CONTROLLER://:9093" \n  --variables "KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://kafka.railway.internal:9092" \n  --variables "KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER" \n  --variables "KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT" \n  --variables "KAFKA_CONTROLLER_QUORUM_VOTERS=1@localhost:9093" \n  --variables "KAFKA_INTER_BROKER_LISTENER_NAME=PLAINTEXT" \n  --variables "KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1" \n  --variables "KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR=1" \n  --variables "KAFKA_TRANSACTION_STATE_LOG_MIN_ISR=1" \n  --variables "KAFKA_AUTO_CREATE_TOPICS_ENABLE=true" \n  --variables "KAFKA_HEAP_OPTS=-Xmx384m -Xms256m"
```

**`PLAINTEXT://[::]:9092` is the important part.** Railway's private network is IPv6, and a broker
bound to `0.0.0.0` listens on IPv4 only — the producer would never reach it. The broker confirms the
right binding in its log: `Awaiting socket connections on 0:0:0:0:0:0:0:0:9092`.

## 3. The five Java services

Create the services, then set their variables:

```bash
for s in auth-service restaurant-service order-service notification-service api-gateway; do
  railway add --service "$s"
done
```

The repo is a monorepo with one Dockerfile per service. Two things to know:

- `railway up` uploads the **git root**, not the current directory, so running it inside
  `auth-service/` still ships the whole repo and the builder finds no application. Either set each
  service's **Root Directory** in the dashboard, or copy the service folder somewhere outside the
  repository and run `railway up` from there.
- Spring properties containing a dash (`grpc.client.restaurant-service.address`,
  `orderstream.cors.allowed-origin`) cannot be expressed as environment variable names. Pass them
  through `SPRING_APPLICATION_JSON` instead.

### Shared variables

On all five: `JAVA_TOOL_OPTIONS = -Xmx192m -XX:MaxMetaspaceSize=128m -XX:+UseSerialGC -Xss256k`

Set `PORT` explicitly on every service (8081–8084, 8080 for the gateway). Railway only injects
`PORT` where a public domain exists, and the gateway addresses its siblings by those fixed ports.

The Postgres password is in the `Postgres` service's variables (`POSTGRES_PASSWORD`), and the host
is `postgres.railway.internal`.

### Per service

**auth-service**
```
SPRING_DATASOURCE_URL      = jdbc:postgresql://postgres.railway.internal:5432/auth_db
SPRING_DATASOURCE_USERNAME = postgres
SPRING_DATASOURCE_PASSWORD = <POSTGRES_PASSWORD>
ORDERSTREAM_JWT_SECRET     = <a fresh 48-byte secret>
```

**restaurant-service**
```
SPRING_DATASOURCE_URL      = jdbc:postgresql://postgres.railway.internal:5432/restaurant_db
SPRING_DATASOURCE_USERNAME = postgres
SPRING_DATASOURCE_PASSWORD = <POSTGRES_PASSWORD>
GRPC_SERVER_ADDRESS        = ::
```
`GRPC_SERVER_ADDRESS = ::` is required: the default binds IPv4 and the private network is IPv6.

**order-service**
```
SPRING_DATASOURCE_URL          = jdbc:postgresql://postgres.railway.internal:5432/order_db
SPRING_DATASOURCE_USERNAME     = postgres
SPRING_DATASOURCE_PASSWORD     = <POSTGRES_PASSWORD>
SPRING_KAFKA_BOOTSTRAP_SERVERS = kafka.railway.internal:9092
SPRING_APPLICATION_JSON        = {"grpc":{"client":{"restaurant-service":{"address":"static://restaurant-service.railway.internal:9090","negotiation-type":"plaintext"}}}}
```

**notification-service**
```
SPRING_KAFKA_BOOTSTRAP_SERVERS = kafka.railway.internal:9092
```

**api-gateway**
```
ORDERSTREAM_JWT_SECRET          = <the same secret as auth-service, byte for byte>
ORDERSTREAM_SERVICES_AUTH       = http://auth-service.railway.internal:8081
ORDERSTREAM_SERVICES_RESTAURANT = http://restaurant-service.railway.internal:8082
ORDERSTREAM_SERVICES_ORDER      = http://order-service.railway.internal:8083
SPRING_APPLICATION_JSON         = {"orderstream":{"cors":{"allowed-origin":"https://<your-app>.vercel.app"}}}
```

`allowed-origin` accepts a comma-separated list, which matters because Vercel answers on more than
one hostname.

### Domains

```bash
railway domain --service api-gateway --port 8080
railway domain --service notification-service --port 8084
```

Nothing else gets a public domain.

## 4. The frontend on Vercel

New project → import this repository → **Root Directory: `frontend`**. `frontend/vercel.json`
already sets the build command and the SPA fallback, so only the two variables are left:

```
API_BASE_URL = https://<api-gateway>.up.railway.app
WS_URL       = wss://<notification-service>.up.railway.app/ws
```

They are read at build time by `scripts/generate-env.mjs`, which writes
`src/environments/environment.prod.ts`. Changing a URL means redeploying, not just restarting.

Once Vercel gives you the real domain, put it into the gateway's `SPRING_APPLICATION_JSON`
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
