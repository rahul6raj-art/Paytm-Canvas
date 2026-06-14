# Kubernetes manifests

Apply in order after provisioning Postgres, Redis, and object storage.

## 1. Namespace

```bash
kubectl apply -f namespace.yaml
```

## 2. Secrets

Copy `secrets.example.env`, fill in production values, then:

```bash
kubectl -n craft create secret generic craft-backend \
  --from-env-file=secrets.example.env
```

Required keys: `DATABASE_URL`, `REDIS_URL`, `S3_ENDPOINT`, `S3_PUBLIC_URL`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`.

Optional SMTP: `CRAFT_SMTP_HOST`, `CRAFT_SMTP_PORT`, `CRAFT_SMTP_FROM`, `CRAFT_SMTP_USER`, `CRAFT_SMTP_PASS`.

## 3. ConfigMap

Edit `CRAFT_API_CORS_ORIGIN` and `CRAFT_APP_URL` in `configmap.yaml`, then:

```bash
kubectl apply -f configmap.yaml
```

## 4. Workloads

Build and push images (replace `REGISTRY`):

```bash
docker build -f packages/craft-api/Dockerfile -t REGISTRY/craft-api:latest .
docker build -f packages/craft-realtime/Dockerfile -t REGISTRY/craft-realtime:latest .
docker push REGISTRY/craft-api:latest
docker push REGISTRY/craft-realtime:latest
```

Update image references in the deployment YAML files, then:

```bash
kubectl apply -f craft-api-deployment.yaml -f craft-api-service.yaml
kubectl apply -f craft-realtime-deployment.yaml -f craft-realtime-service.yaml
```

## 5. Ingress (optional)

Edit hostnames in `ingress.yaml` and install an NGINX Ingress Controller. WebSocket path `/yjs` is routed to `craft-realtime`.

## Health checks

| Service | Probe path |
|---------|------------|
| craft-api | `GET /health` |
| craft-realtime | `GET /` |
