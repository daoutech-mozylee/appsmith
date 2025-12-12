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

### 방법 2: Docker만 빌드 (아티팩트가 이미 있는 경우)

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
