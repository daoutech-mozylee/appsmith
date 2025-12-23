# Relay Service (all-apps-server) 구성 가이드

## 개요

Appsmith 컨테이너 내에서 실행되는 중계 서비스(Relay Service) 구성 방법.

- **프로젝트**: `app/all-apps-server`
- **기술 스택**: Spring Boot 3.5.9, JDK 21, Redis
- **포트**: 8090
- **Context Path**: `/relay`
- **외부 경로**: `/relay/api/*`, `/all-apps/relay/api/*`

---

## 수정 파일 목록

| 파일 | 작업 | 설명 |
|------|------|------|
| `app/all-apps-server/` | 신규 | Spring Boot 프로젝트 |
| `deploy/docker/fs/opt/appsmith/caddy-reconfigure.mjs` | 수정 | Caddy 라우팅 규칙 추가 |
| `deploy/docker/fs/opt/appsmith/entrypoint.sh` | 수정 | 로그 디렉토리 생성 추가 |
| `deploy/docker/fs/opt/appsmith/templates/supervisord/application_process/relay.conf` | 신규 | Supervisor 프로세스 설정 |
| `deploy/docker/fs/opt/appsmith/run-relay.sh` | 신규 | 실행 스크립트 |
| `deploy/docker/fs/opt/appsmith/relay/` | 신규 | JAR 파일 디렉토리 |
| `scripts/local_testing.sh` | 수정 | 빌드 단계 추가 |
| `app/client/start-https.sh` | 수정 | 로컬 개발 라우팅 추가 |

---

## 1. Caddy 라우팅 설정

### 파일: `deploy/docker/fs/opt/appsmith/caddy-reconfigure.mjs`

### 라우팅 패턴 (RTS와 동일)

```javascript
# Relay Service (all-apps-server) - RTS와 동일 패턴
handle /relay/* {
  import reverse_proxy 8090
}

handle /all-apps/relay/* {
  uri strip_prefix /all-apps
  import reverse_proxy 8090
}
```

### Health Check 로그 스킵

```javascript
log_skip /relay/api/health
log_skip /all-apps/relay/api/health
```

### 라우팅 테이블

| 외부 경로 | 내부 처리 | 서비스 |
|----------|----------|--------|
| `/api/*` | 직접 전달 | Backend (8080) |
| `/relay/*` | 직접 전달 | Relay (8090) |
| `/all-apps/relay/*` | strip `/all-apps` → `/relay/*` | Relay (8090) |
| `/rts/*` | 직접 전달 | RTS (8091) |
| `/all-apps/rts/*` | strip `/all-apps` → `/rts/*` | RTS (8091) |

### 요청 흐름

```
Client: GET /relay/api/health
         ↓
Caddy:   handle /relay/* (직접 전달)
         ↓
Relay:   GET /relay/api/health (8090)

Client: GET /all-apps/relay/api/health
         ↓
Caddy:   strip_prefix /all-apps → /relay/api/health
         ↓
Relay:   GET /relay/api/health (8090)
```

---

## 2. Spring Boot 설정

### 파일: `app/all-apps-server/src/main/resources/application.yml`

```yaml
server:
  port: 8090
  servlet:
    context-path: /relay  # 중요: RTS 패턴과 동일하게 context-path 사용

spring:
  application:
    name: all-apps-server
  data:
    redis:
      url: ${APPSMITH_REDIS_URL:redis://localhost:6379}

management:
  endpoints:
    web:
      exposure:
        include: health,info

logging:
  level:
    root: INFO
    com.daou.allapps: DEBUG
```

### Controller 매핑

```java
@RestController
@RequestMapping("/api")  // context-path와 결합: /relay/api
public class HealthController {

    @GetMapping("/health")   // 최종 경로: /relay/api/health
    public ResponseEntity<Map<String, Object>> health() { ... }

    @GetMapping("/ping")     // 최종 경로: /relay/api/ping
    public ResponseEntity<String> ping() { ... }
}
```

### API 엔드포인트

| 외부 경로 | 내부 경로 | 설명 |
|----------|----------|------|
| `/relay/api/health` | `/relay/api/health` | 서비스 상태 + Redis 연결 확인 |
| `/relay/api/ping` | `/relay/api/ping` | 간단한 ping/pong |
| `/all-apps/relay/api/health` | `/relay/api/health` | all-apps prefix 지원 |

---

## 3. 로컬 개발 환경

### 파일: `app/client/start-https.sh`

#### 추가된 변수

```bash
relay_host=${relay_host-$upstream_host}
relay_port=${relay_port-8090}
relay="http://$relay_host:$relay_port"
```

#### 추가된 location 블록

```nginx
# Relay Service (all-apps-server)
location /relay {
    proxy_pass $relay;
}

location /all-apps/relay {
    rewrite ^/all-apps(.*)$ $1 break;
    proxy_pass $relay;
}
```

### 로컬 테스트 방법

```bash
# 터미널 1: Relay Service 실행
cd app/all-apps-server
./gradlew bootRun

# 터미널 2: 테스트
curl http://localhost:8090/relay/api/health
curl http://localhost:8090/relay/api/ping
```

---

## 4. Supervisor 설정

### 파일: `deploy/docker/fs/opt/appsmith/templates/supervisord/application_process/relay.conf`

```ini
[program:relay]
command=/opt/appsmith/run-with-env.sh /opt/appsmith/run-relay.sh
autorestart=true
autostart=true
priority=25
startretries=3
startsecs=10
stderr_events_enabled=true
stderr_logfile=%(ENV_APPSMITH_LOG_DIR)s/%(program_name)s/%(ENV_HOSTNAME)s-stderr.log
stderr_logfile_backups=0
stderr_logfile_maxbytes=30MB
stdout_events_enabled=true
stdout_logfile=%(ENV_APPSMITH_LOG_DIR)s/%(program_name)s/%(ENV_HOSTNAME)s-stdout.log
stdout_logfile_backups=0
stdout_logfile_maxbytes=30MB
```

---

## 5. 실행 스크립트

### 파일: `deploy/docker/fs/opt/appsmith/run-relay.sh`

```bash
#!/bin/bash

set -o errexit
set -o pipefail
set -o nounset

cd /opt/appsmith/relay

if type tlog &>/dev/null; then
  tlog "Starting Relay Service (all-apps-server)..."
else
  echo "Starting Relay Service (all-apps-server)..."
fi

exec /opt/java/bin/java \
  -Dserver.port=8090 \
  -Djava.security.egd=file:/dev/./urandom \
  ${RELAY_JAVA_ARGS:-} \
  -jar all-apps-server.jar
```

---

## 6. 빌드 및 배포

### 빌드 순서

```
1. Server 빌드      (app/server)
2. Client 빌드      (app/client)
3. RTS 빌드         (app/client/packages/rts)
4. Relay 빌드       (app/all-apps-server)  ← 추가
5. Docker 빌드
```

### 수동 빌드

```bash
# Relay Service 빌드
cd app/all-apps-server
./gradlew build -x test
cp build/libs/all-apps-server.jar ../../deploy/docker/fs/opt/appsmith/relay/

# Docker 이미지 빌드 (예시)
docker buildx build \
  --platform linux/amd64 \
  -t asia-northeast3-docker.pkg.dev/daouoffice-dop-dev/dev-dop-images/appsmith-do-edition:1.0.23 \
  --build-arg BASE="appsmith/base-ce:release" \
  --load \
  .
```

---

## 7. 트러블슈팅

### 라우팅 설계 시 주의사항

#### 문제 상황 (1.0.20 ~ 1.0.21)

초기에 다음과 같이 설정했을 때 Backend 연결 실패 발생:

```javascript
// 문제가 된 설정
handle /relay/api/* {
  uri strip_prefix /relay    // /relay/api/* → /api/*
  import reverse_proxy 8090
}

handle /all-apps/relay/api/* {
  uri strip_prefix /all-apps/relay  // /all-apps/relay/api/* → /api/*
  import reverse_proxy 8090
}
```

#### 원인

- `strip_prefix` 후 결과 경로 `/api/*`가 `@backend` 패턴과 충돌 가능성
- RTS는 `/rts/*` 경로를 유지하여 충돌 없음

#### 해결 방법

RTS와 동일한 패턴 적용 - **context-path 사용**:

```yaml
# application.yml
server:
  servlet:
    context-path: /relay
```

```javascript
// Caddy - strip_prefix 없이 직접 전달
handle /relay/* {
  import reverse_proxy 8090
}

handle /all-apps/relay/* {
  uri strip_prefix /all-apps  // /all-apps/relay/* → /relay/*
  import reverse_proxy 8090
}
```

### 로그 디렉토리 오류

#### 증상

```
Error: The directory named as part of the path /appsmith-stacks/logs/relay/... does not exist
```

#### 해결

`deploy/docker/fs/opt/appsmith/entrypoint.sh`에 `relay` 디렉토리 추가:

```bash
mkdir -p "$APPSMITH_LOG_DIR"/{supervisor,backend,cron,editor,rts,relay,mongodb,redis,postgres,appsmithctl}
```

---

## 8. 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `APPSMITH_REDIS_URL` | `redis://localhost:6379` | Redis 연결 URL |
| `RELAY_JAVA_ARGS` | (없음) | 추가 JVM 옵션 |

---

## 9. 프로젝트 구조

```
app/all-apps-server/
├── build.gradle
├── settings.gradle
├── gradlew / gradlew.bat
├── .gitignore
└── src/
    ├── main/
    │   ├── java/com/daou/allapps/
    │   │   ├── AllAppsServerApplication.java
    │   │   ├── config/
    │   │   │   └── RedisConfig.java
    │   │   └── controller/
    │   │       ├── HealthController.java
    │   │       └── TestController.java
    │   └── resources/
    │       └── application.yml
    └── test/
        └── java/com/daou/allapps/
            └── AllAppsServerApplicationTests.java
```

---

## 참고

- [GCLOUD_DEPLOY.md](./GCLOUD_DEPLOY.md) - Docker 이미지 빌드 및 배포
- [HELM.md](./HELM.md) - Kubernetes Helm 차트
- [REDIS.md](./REDIS.md) - Redis 사용 현황
