# Appsmith Helm Chart 분석

## 개요

Appsmith Helm 차트는 Kubernetes 환경에서 Appsmith 애플리케이션과 관련 의존성을 배포합니다.

- **차트 버전**: 3.6.7
- **위치**: `deploy/helm/`

---

## 배포되는 Pod 종류

### 1. 메인 애플리케이션 Pod

| 워크로드 | 이름 | 이미지 | 설명 |
|---------|------|-------|------|
| **StatefulSet** 또는 **Deployment** | `appsmith` | `appsmith/appsmith-ee:latest` | 메인 Appsmith 서버 (기본: StatefulSet) |

- 기본값은 `StatefulSet` (1 replica)
- `autoscaling.enabled=true` 또는 `workload.kind=Deployment` 시 Deployment로 전환
- **InitContainers**: Redis, MongoDB, PostgreSQL 준비 대기용

### 2. 서브차트 (Dependencies) Pods

| Pod | 조건 | 이미지 | 기본 Replica | 용도 |
|-----|------|-------|-------------|------|
| **Redis Master** | `redis.enabled=true` | `redis:7.0.15` | 1 | 세션/캐시 스토리지 |
| **Redis Replica** | `redis.enabled=true` | `redis:7.0.15` | 1 | Redis 복제본 |
| **MongoDB** | `mongodb.enabled=true` | `bitnami/mongodb:6.0.13` | 2 (ReplicaSet) | 메인 데이터베이스 |
| **MongoDB Arbiter** | `mongodb.enabled=true` | `bitnami/mongodb:6.0.13` | 1 | ReplicaSet 투표용 |
| **PostgreSQL** | `postgresql.enabled=true` | `bitnami/postgresql:14.12.0` | 1 | Keycloak DB |
| **Prometheus** | `prometheus.enabled=false` | `prometheus:v2.54.1` | (선택) | 모니터링 |

### 3. 선택적 CronJob Pod

| CronJob | 조건 | 이미지 | 스케줄 | 용도 |
|---------|------|-------|--------|------|
| **imago** | `autoupdate.enabled=true` | `philpep/imago` | `0 * * * *` (매시간) | 이미지 자동 업데이트 |

---

## 기본 설정 기준 Pod 구성

```
기본 설정 (values.yaml defaults)
├── appsmith (StatefulSet)           - 1 pod
├── redis-master                     - 1 pod
├── redis-replicas                   - 1 pod
├── mongodb (ReplicaSet)             - 2 pods + 1 arbiter
└── postgresql                       - 1 pod
                                     --------
                            총 약 6~7개 pods
```

---

## 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────┐
│                        Kubernetes Cluster                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐     ┌─────────────────┐                │
│  │   Ingress       │────▶│   Service       │                │
│  │   (optional)    │     │   (ClusterIP)   │                │
│  └─────────────────┘     └────────┬────────┘                │
│                                   │                          │
│                                   ▼                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │             Appsmith (StatefulSet/Deployment)          │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │  InitContainers:                                 │  │ │
│  │  │  - redis-init (wait for redis)                   │  │ │
│  │  │  - mongo-init (wait for mongo)                   │  │ │
│  │  │  - psql-init  (wait for postgres)                │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │  Container: appsmith                             │  │ │
│  │  │  - Ports: 80 (HTTP), 443 (HTTPS), 2019 (metrics) │  │ │
│  │  │  - Volume: /appsmith-stacks (PVC)                │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
│           │              │              │                    │
│           ▼              ▼              ▼                    │
│  ┌──────────────┐ ┌───────────────┐ ┌──────────────────┐    │
│  │    Redis     │ │   MongoDB     │ │   PostgreSQL     │    │
│  │   (Bitnami)  │ │  (Bitnami)    │ │   (Bitnami)      │    │
│  │              │ │               │ │                  │    │
│  │ master:  1   │ │ primary: 1    │ │ primary: 1       │    │
│  │ replica: 1   │ │ secondary: 1  │ │ (Keycloak DB)    │    │
│  │              │ │ arbiter: 1    │ │                  │    │
│  └──────────────┘ └───────────────┘ └──────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │   Optional Components                                 │   │
│  │   - Prometheus (monitoring)                           │   │
│  │   - imago CronJob (auto-update)                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Appsmith 이미지 빌드 방법

Helm 차트에서 사용하는 `appsmith/appsmith-ee` 이미지를 직접 빌드하는 방법입니다.

### 빌드 스크립트

```bash
# 로컬 코드 기반 전체 빌드
./scripts/local_testing.sh -l [tag]

# 특정 브랜치 기반 빌드
./scripts/local_testing.sh [branch_name] [tag]
```

### 빌드 순서

| 순서 | 단계 | 명령어 | 결과물 |
|-----|------|-------|-------|
| 1 | Server 빌드 | `app/server/build.sh -DskipTests` | `app/server/dist/` |
| 2 | 아티팩트 준비 | `scripts/prepare_server_artifacts.sh` | `deploy/docker/fs/opt/appsmith/server/` |
| 3 | Client 빌드 | `cd app/client && yarn && yarn build` | `app/client/build/` |
| 4 | RTS 빌드 | `app/client/packages/rts/build.sh` | `app/client/packages/rts/dist/` |
| 5 | 메타정보 생성 | `scripts/generate_info_json.sh` | `deploy/docker/fs/opt/appsmith/info.json` |
| 6 | Docker 빌드 | `docker build ...` | Docker 이미지 |

### Docker 빌드 명령어

```bash
docker build -t appsmith/appsmith-local-ce:latest \
  --build-arg BASE="appsmith/base-ce:release" \
  --build-arg APPSMITH_CLOUD_SERVICES_BASE_URL="https://release-cs.appsmith.com" \
  .
```

### 이미지 구성요소

| 구성요소 | 소스 | 컨테이너 내 경로 |
|---------|------|----------------|
| 기본 파일시스템 | `deploy/docker/fs/` | `/` |
| 백엔드 서버 | `app/server/dist/` | `/opt/appsmith/server/mongo/server.jar` |
| DB 플러그인 (22개) | 빌드 결과물 | `/opt/appsmith/server/mongo/plugins/` |
| 프론트엔드 UI | `app/client/build/` | `/editor/` |
| RTS | `app/client/packages/rts/dist/` | `/rts/` |
| 빌드 메타정보 | 자동 생성 | `/opt/appsmith/info.json` |
| 커스텀 CA 인증서 | `daou_ssl.crt` | `/usr/local/share/ca-certificates/` |

### 포함된 플러그인 목록

```
postgresPlugin, mysqlPlugin, mongoPlugin, redisPlugin,
restApiPlugin, graphqlPlugin, googleSheetsPlugin, amazons3Plugin,
firestorePlugin, dynamoPlugin, elasticSearchPlugin, mssqlPlugin,
oraclePlugin, snowflakePlugin, redshiftPlugin, databricksPlugin,
arangodbPlugin, awsLambdaPlugin, smtpPlugin, jsPlugin,
openAiPlugin, anthropicPlugin, googleAiPlugin, appsmithAiPlugin,
saasPlugin
```

### 베이스 이미지

- **CE**: `appsmith/base-ce:release`
- **EE**: `appsmith/base-ee:release`

베이스 이미지에는 다음 런타임 의존성이 포함되어 있습니다:
- Java, Node.js, Caddy (웹서버)
- **임베디드 MongoDB, Redis, PostgreSQL**

### 임베디드 DB vs 외부 DB

| 배포 환경 | MongoDB | Redis | PostgreSQL | 설정 |
|----------|---------|-------|------------|------|
| **Docker 단독** | 임베디드 | 임베디드 | 임베디드 | 기본값 |
| **Kubernetes/Helm** | 별도 Pod | 별도 Pod | 별도 Pod | `APPSMITH_ENABLE_EMBEDDED_DB=0` |

Helm 차트 배포 시 `deployment.yaml`에서 임베디드 DB를 비활성화합니다:
```yaml
- name: APPSMITH_ENABLE_EMBEDDED_DB
  value: "0"
```

`entrypoint.sh`에서 URL이 `localhost`인 경우에만 임베디드 DB를 시작합니다.

---

## 주요 설정별 Pod 변화

| 설정 | Pod 변화 |
|-----|---------|
| `redis.enabled=false` | Redis pods 제거 |
| `mongodb.enabled=false` | MongoDB pods 제거 (외부 DB 필요) |
| `postgresql.enabled=false` | PostgreSQL pod 제거 |
| `autoscaling.enabled=true` | Appsmith → Deployment + HPA |
| `prometheus.enabled=true` | Prometheus pod 추가 |
| `autoupdate.enabled=true` | imago CronJob 추가 |

---

## Helm Templates 구성

| 파일 | 리소스 종류 | 설명 |
|-----|-----------|------|
| `deployment.yaml` | StatefulSet/Deployment | 메인 Appsmith 워크로드 |
| `service.yaml` | Service | ClusterIP 서비스 |
| `headless-svc.yaml` | Service | StatefulSet용 헤드리스 서비스 |
| `ingress.yaml` | Ingress | 외부 접근용 인그레스 |
| `configMap.yaml` | ConfigMap | 환경 설정 |
| `secret.yaml` | Secret | 민감 정보 |
| `persistentVolume.yaml` | PersistentVolume | 로컬 스토리지 PV |
| `persistentVolumeClaim.yaml` | PersistentVolumeClaim | 볼륨 클레임 |
| `storageClass.yaml` | StorageClass | 스토리지 클래스 |
| `serviceaccount.yaml` | ServiceAccount | 서비스 계정 |
| `hpa.yml` | HorizontalPodAutoscaler | 오토스케일링 |
| `pdb.yml` | PodDisruptionBudget | Pod 중단 예산 |
| `scaledobject.yml` | ScaledObject | KEDA 스케일링 |
| `autoupdate.yaml` | CronJob + RBAC | 자동 업데이트 |
| `tls-secret.yaml` | Secret | TLS 인증서 |
| `trustedCA.yaml` | ConfigMap | 커스텀 CA 인증서 |
| `external-secrets.yaml` | ExternalSecret | 외부 시크릿 연동 |
| `service-metrics.yaml` | Service | 메트릭 서비스 |

---

## 주요 환경 변수 (applicationConfig)

| 변수 | 설명 |
|-----|------|
| `APPSMITH_DB_URL` | MongoDB 연결 URL |
| `APPSMITH_REDIS_URL` | Redis 연결 URL |
| `APPSMITH_ENCRYPTION_PASSWORD` | 암호화 비밀번호 |
| `APPSMITH_ENCRYPTION_SALT` | 암호화 솔트 |
| `APPSMITH_OAUTH2_GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID |
| `APPSMITH_OAUTH2_GITHUB_CLIENT_ID` | GitHub OAuth 클라이언트 ID |
| `APPSMITH_MAIL_ENABLED` | 메일 기능 활성화 |
| `APPSMITH_DISABLE_TELEMETRY` | 텔레메트리 비활성화 |
| `APPSMITH_LICENSE_KEY` | EE 라이선스 키 |
| `APPSMITH_KEYCLOAK_DB_URL` | Keycloak PostgreSQL URL |

---

## 리소스 기본값

```yaml
resources:
  requests:
    cpu: 500m
    memory: 3000Mi
  limits: {}
```

---

## 참고 문서

- `deploy/helm/README.md` - Helm 차트 사용 가이드
- `deploy/helm/Setup-https.md` - HTTPS 설정 가이드
- `deploy/helm/Publish-helm-chart.md` - 차트 배포 가이드
