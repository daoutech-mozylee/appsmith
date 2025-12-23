# Appsmith Helm Chart 분석

## 개요

- **차트 버전**: 3.6.7
- **위치**: `deploy/helm/`

---

## 배포되는 Pod 구성

### 기본 설정 기준 (총 6~7개 pods)

```
├── appsmith (StatefulSet)           - 1 pod   (메인 애플리케이션)
├── redis-master                     - 1 pod   (세션/캐시)
├── redis-replicas                   - 1 pod
├── mongodb (ReplicaSet)             - 2 pods  (메인 DB)
├── mongodb-arbiter                  - 1 pod
└── postgresql                       - 1 pod   (Keycloak DB)
```

### 설정별 Pod 변화

| 설정 | Pod 변화 |
|-----|---------|
| `redis.enabled=false` | Redis pods 제거 |
| `mongodb.enabled=false` | MongoDB pods 제거 (외부 DB 필요) |
| `postgresql.enabled=false` | PostgreSQL pod 제거 |
| `autoscaling.enabled=true` | Appsmith → Deployment + HPA |
| `prometheus.enabled=true` | Prometheus pod 추가 |
| `autoupdate.enabled=true` | imago CronJob 추가 |

---

## 아키텍처

```mermaid
flowchart TB
    subgraph K8S["Kubernetes Cluster"]
        INGRESS["Ingress"] --> SERVICE["Service"] --> APP["Appsmith Pod"]

        subgraph REDIS["Redis"]
            RM["master/1"]
            RR["replica/1"]
        end

        subgraph MONGODB["MongoDB"]
            MP["primary/1"]
            MS["second/1"]
            MA["arbiter/1"]
        end

        subgraph PG["PostgreSQL"]
            PP["primary/1<br/>(Keycloak)"]
        end

        APP --> REDIS
        APP --> MONGODB
        APP --> PG
    end
```

---

## Appsmith 이미지 빌드

### 빌드 명령어

```bash
# 로컬 코드 기반 빌드
./scripts/local_testing.sh -l [tag]

# 특정 브랜치 기반 빌드
./scripts/local_testing.sh [branch_name] [tag]
```

### 빌드 순서

| 순서 | 단계 | 결과물 |
|-----|------|-------|
| 1 | Server 빌드 | `app/server/dist/` |
| 2 | 아티팩트 준비 | `deploy/docker/fs/opt/appsmith/server/` |
| 3 | Client 빌드 | `app/client/build/` |
| 4 | RTS 빌드 | `app/client/packages/rts/dist/` |
| 5 | 메타정보 생성 | `info.json` |
| 6 | Docker 빌드 | Docker 이미지 |

### 이미지 구성요소

| 구성요소 | 컨테이너 내 경로 |
|---------|----------------|
| 백엔드 서버 | `/opt/appsmith/server/mongo/server.jar` |
| DB 플러그인 | `/opt/appsmith/server/mongo/plugins/` |
| 프론트엔드 UI | `/editor/` |
| RTS | `/rts/` |

### 임베디드 DB vs 외부 DB

| 배포 환경 | DB 구성 | 설정 |
|----------|--------|------|
| **Docker 단독** | 임베디드 MongoDB/Redis/PostgreSQL | 기본값 |
| **Kubernetes** | 별도 Pod | `APPSMITH_ENABLE_EMBEDDED_DB=0` |

---

## Templates 구성

### 핵심 리소스

| 파일 | 리소스 | 역할 |
|------|-------|------|
| deployment.yaml | StatefulSet/Deployment | Appsmith Pod |
| service.yaml | Service | 트래픽 노출 |
| ingress.yaml | Ingress | 도메인 연결 |
| configMap.yaml | ConfigMap | 환경변수 |
| secret.yaml | Secret | 민감 정보 |

### 스토리지

| 파일 | 리소스 |
|------|-------|
| persistentVolume.yaml | PersistentVolume |
| persistentVolumeClaim.yaml | PersistentVolumeClaim |
| storageClass.yaml | StorageClass |

### 스케일링 & 보안

| 파일 | 리소스 |
|------|-------|
| hpa.yml | HorizontalPodAutoscaler |
| pdb.yml | PodDisruptionBudget |
| serviceaccount.yaml | ServiceAccount |
| tls-secret.yaml | TLS Secret |

---

## 주요 환경 변수

| 변수 | 설명 |
|-----|------|
| `APPSMITH_DB_URL` | MongoDB 연결 URL |
| `APPSMITH_REDIS_URL` | Redis 연결 URL |
| `APPSMITH_ENCRYPTION_PASSWORD` | 암호화 비밀번호 |
| `APPSMITH_ENCRYPTION_SALT` | 암호화 솔트 |
| `APPSMITH_LICENSE_KEY` | EE 라이선스 키 |
| `APPSMITH_KEYCLOAK_DB_URL` | Keycloak PostgreSQL URL |

---

## 사용 예시

### 기본 설치

```bash
helm repo add stable-appsmith http://helm.appsmith.com
helm install appsmith stable-appsmith/appsmith
```

### 외부 DB 사용

```bash
helm install appsmith stable-appsmith/appsmith \
  --set mongodb.enabled=false \
  --set redis.enabled=false \
  --set applicationConfig.APPSMITH_DB_URL="mongodb+srv://user:pass@host/db" \
  --set applicationConfig.APPSMITH_REDIS_URL="redis://host:6379"
```

### Ingress + TLS

```bash
helm install appsmith stable-appsmith/appsmith \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=appsmith.example.com \
  --set ingress.tls=true \
  --set ingress.certManager=true
```

### 오토스케일링

```bash
helm install appsmith stable-appsmith/appsmith \
  --set autoscaling.enabled=true \
  --set autoscaling.minReplicas=2 \
  --set autoscaling.maxReplicas=5
```

---

## 트러블슈팅

```bash
# Pod 상태 확인
kubectl get pods -l app.kubernetes.io/name=appsmith
kubectl logs <pod-name>

# 포트포워딩
kubectl port-forward svc/appsmith 8080:80
```

---

## 참고

- [Helm Chart README](../../deploy/helm/README.md)
- [Appsmith Self Hosting Docs](https://docs.appsmith.com/getting-started/setup)
