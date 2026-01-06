# Appsmith Docker 이미지 빌드 및 GCP 배포 가이드

## 개요

Appsmith Docker 이미지를 빌드하고 GCP Artifact Registry에 배포하는 방법을 설명합니다.

---

## GCP Artifact Registry 정보

| 항목 | 값 |
|-----|-----|
| **Registry** | `asia-northeast3-docker.pkg.dev` |
| **Project** | `daouoffice-dop-dev` |
| **Repository** | `dev-dop-images` |
| **Image Name** | `appsmith-do-edition` |

---

## 사전 준비

### 1. GCP 인증 설정

```bash
# gcloud CLI 로그인
gcloud auth login

# Docker 인증 설정
gcloud auth configure-docker asia-northeast3-docker.pkg.dev
```

### 2. 프로젝트 설정

```bash
gcloud config set project daouoffice-dop-dev
```

---

## 빌드 방법

### 방법 1: 전체 빌드 (local_testing.sh) - 권장

서버, 클라이언트, RTS를 모두 빌드하고 Docker 이미지를 GCP 레지스트리 경로로 직접 생성합니다.

```bash
# 로컬 코드 기반 빌드
./scripts/local_testing.sh -l [tag]

# 예시: 1.0.2 태그로 빌드
./scripts/local_testing.sh -l 1.0.2
```

**결과 이미지:**
```
asia-northeast3-docker.pkg.dev/daouoffice-dop-dev/dev-dop-images/appsmith-do-edition:[tag]
```

**빌드 순서:**
1. Server 빌드: `app/server/build.sh -DskipTests`
2. 아티팩트 준비: `scripts/prepare_server_artifacts.sh`
3. Client 빌드: `cd app/client && yarn && yarn build`
4. RTS 빌드: `app/client/packages/rts/build.sh`
5. 메타정보 생성: `scripts/generate_info_json.sh`
6. Docker 빌드 (`linux/amd64` 플랫폼)

6. Docker 빌드 (`linux/amd64` 플랫폼)

### 방법 2: 고속 빌드 (Fast Build) - 수정 사항 반복 테스트용

코드를 수정한 후 빠르게 Docker 이미지를 다시 빌드하고 싶을 때 사용합니다. `mvn clean` 과정을 생략하여 변경된 모듈만 다시 컴파일(증분 빌드)합니다.

```bash
# --fast 또는 -f 옵션 사용
./scripts/local_testing.sh -l --fast [tag]

# 예시
./scripts/local_testing.sh -l --fast 1.0.3-snapshot
```

> [!WARNING]
> Fast Build는 기존 빌드 아티팩트(`dist/` 폴더)를 지우지 않습니다.
> 확실한 무결성이 필요한 프로덕션 배포 전에는 `--fast` 옵션 없이 일반 빌드를 수행하는 것을 권장합니다.

### 방법 3: Docker만 빌드 (아티팩트가 이미 있는 경우)

이미 빌드된 아티팩트가 있다면 Docker 이미지만 빌드할 수 있습니다.

#### 필수 아티팩트 확인

```bash
# 서버 JAR
ls deploy/docker/fs/opt/appsmith/server/mongo/server.jar

# 클라이언트 빌드
ls app/client/build/index.html

# RTS 빌드
ls app/client/packages/rts/dist/

# 메타정보
ls deploy/docker/fs/opt/appsmith/info.json
```

#### Docker 빌드 (amd64 플랫폼)

```bash
TAG=1.0.2
FULL_IMAGE="asia-northeast3-docker.pkg.dev/daouoffice-dop-dev/dev-dop-images/appsmith-do-edition:$TAG"

docker buildx build \
  --platform linux/amd64 \
  -t $FULL_IMAGE \
  --build-arg BASE="appsmith/base-ce:release" \
  --build-arg APPSMITH_CLOUD_SERVICES_BASE_URL="https://release-cs.appsmith.com" \
  --load \
  .
```

---

## GCP Artifact Registry 배포

`local_testing.sh`로 빌드하면 이미지가 GCP 레지스트리 경로로 직접 생성되므로 **태그 변경 없이 바로 푸시**할 수 있습니다.

### 1. 이미지 푸시

```bash
docker push asia-northeast3-docker.pkg.dev/daouoffice-dop-dev/dev-dop-images/appsmith-do-edition:[TAG]

# 예시
docker push asia-northeast3-docker.pkg.dev/daouoffice-dop-dev/dev-dop-images/appsmith-do-edition:1.0.2
```

### 2. 배포 확인

```bash
# 이미지 목록 확인
gcloud artifacts docker images list \
  asia-northeast3-docker.pkg.dev/daouoffice-dop-dev/dev-dop-images/appsmith-do-edition

# 특정 태그 확인
gcloud artifacts docker images describe \
  asia-northeast3-docker.pkg.dev/daouoffice-dop-dev/dev-dop-images/appsmith-do-edition:[TAG]
```

---

## 빠른 배포 (빌드 + 푸시)

```bash
# 1. 전체 빌드 (서버 + 클라이언트 + RTS + Docker)
./scripts/local_testing.sh -l 1.0.2

# 2. 푸시
docker push asia-northeast3-docker.pkg.dev/daouoffice-dop-dev/dev-dop-images/appsmith-do-edition:1.0.2
```

또는 Docker만 빌드 후 푸시:

```bash
# 1. Docker만 빌드 (아티팩트가 이미 있는 경우)
TAG=1.0.2
FULL_IMAGE="asia-northeast3-docker.pkg.dev/daouoffice-dop-dev/dev-dop-images/appsmith-do-edition:$TAG"

docker buildx build \
  --platform linux/amd64 \
  -t $FULL_IMAGE \
  --build-arg BASE="appsmith/base-ce:release" \
  --build-arg APPSMITH_CLOUD_SERVICES_BASE_URL="https://release-cs.appsmith.com" \
  --load \
  .

# 2. 푸시
docker push $FULL_IMAGE
```

---

## Kubernetes에서 사용

### Helm values.yaml 설정

```yaml
image:
  registry: asia-northeast3-docker.pkg.dev
  repository: daouoffice-dop-dev/dev-dop-images/appsmith-do-edition
  tag: "1.0.1"
  pullPolicy: IfNotPresent
```

### 직접 Pod 설정

```yaml
spec:
  containers:
  - name: appsmith
    image: asia-northeast3-docker.pkg.dev/daouoffice-dop-dev/dev-dop-images/appsmith-do-edition:1.0.1
```

---

## 커스텀 서비스 추가 (Supervisor)

Appsmith 컨테이너에 추가 서비스(예: Spring Boot BE)를 포함시키는 방법.

### 동작 원리

```dockerfile
# Dockerfile 핵심 라인
COPY deploy/docker/fs /
CMD ["/usr/bin/supervisord", "-n"]
```

- `deploy/docker/fs/` 디렉토리 전체가 컨테이너 루트(`/`)로 복사됨
- Supervisor가 `templates/supervisord/application_process/*.conf` 파일들을 로드하여 프로세스 관리

### 파일 구조

```
deploy/docker/fs/
└── opt/appsmith/
    ├── your-service/
    │   └── app.jar                         # 서비스 실행 파일
    ├── run-your-service.sh                 # 실행 스크립트
    └── templates/supervisord/
        └── application_process/
            ├── backend.conf                # Appsmith BE
            ├── rts.conf                    # RTS
            ├── editor.conf                 # Frontend
            └── your-service.conf           # 추가 서비스 설정
```

### Step 1: 실행 스크립트 생성

```bash
# deploy/docker/fs/opt/appsmith/run-your-service.sh
#!/bin/bash
exec /opt/java/bin/java -jar /opt/appsmith/your-service/app.jar
```

### Step 2: Supervisor 설정 추가

```ini
# deploy/docker/fs/opt/appsmith/templates/supervisord/application_process/your-service.conf
[program:your-service]
command=/opt/appsmith/run-with-env.sh /opt/appsmith/run-your-service.sh
autorestart=true
autostart=true
priority=25
startretries=3
startsecs=10
stderr_logfile=%(ENV_APPSMITH_LOG_DIR)s/%(program_name)s/%(ENV_HOSTNAME)s-stderr.log
stderr_logfile_backups=0
stderr_logfile_maxbytes=30MB
stdout_logfile=%(ENV_APPSMITH_LOG_DIR)s/%(program_name)s/%(ENV_HOSTNAME)s-stdout.log
stdout_logfile_backups=0
stdout_logfile_maxbytes=30MB
```

### Step 3: 서비스 파일 배치

```bash
# 디렉토리 생성
mkdir -p deploy/docker/fs/opt/appsmith/your-service

# jar 파일 복사
cp your-app.jar deploy/docker/fs/opt/appsmith/your-service/app.jar

# 실행 스크립트 권한 부여
chmod +x deploy/docker/fs/opt/appsmith/run-your-service.sh
```

### Step 4: 빌드 및 배포

```bash
# 빌드
./scripts/local_testing.sh -l 1.0.3

# 푸시
docker push asia-northeast3-docker.pkg.dev/daouoffice-dop-dev/dev-dop-images/appsmith-do-edition:1.0.3
```

### 주의사항

| 항목 | 설명 |
|-----|------|
| Java 버전 | 컨테이너에 Java 17 설치됨 (`/opt/java/bin/java`) |
| 포트 충돌 | 기존 서비스 포트(80, 443, 8080 등) 피해서 설정 |
| 로그 경로 | `%(ENV_APPSMITH_LOG_DIR)s` 환경변수 사용 권장 |
| 프로세스 관리 | Supervisor가 자동 재시작 처리 |

### 장단점

| 장점 | 단점 |
|-----|-----|
| 빠른 테스트/PoC 가능 | 개별 스케일링 불가 |
| 같은 컨테이너 내 localhost 통신 | 컨테이너 재시작 시 모든 서비스 재시작 |
| 별도 Dockerfile 수정 불필요 | 서비스 간 리소스 경합 가능 |

---

## 배포 이력

| 버전 | 날짜 | 플랫폼 | 비고 |
|-----|------|-------|------|
| 1.0.0 | - | arm64 | 초기 버전 |
| 1.0.1 | 2024-12-12 | linux/amd64 | amd64 플랫폼 지원 |

---

## 트러블슈팅

### 플랫폼 불일치 오류

```
image with reference was found but does not provide the specified platform (linux/amd64)
```

**해결:** `docker buildx`를 사용하고 `--platform linux/amd64` 옵션 추가

### 인증 오류

```
denied: Permission denied
```

**해결:**
```bash
gcloud auth configure-docker asia-northeast3-docker.pkg.dev
```

### 레거시 빌더 경고

```
DEPRECATED: The legacy builder is deprecated
```

**해결:** `docker buildx build` 사용 (buildx가 기본 빌더로 설정됨)

---

## 참고

- [HELM.md](./HELM.md) - Helm 차트 배포 가이드
- [GCP Artifact Registry 문서](https://cloud.google.com/artifact-registry/docs)
