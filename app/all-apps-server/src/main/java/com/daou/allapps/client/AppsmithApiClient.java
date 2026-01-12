package com.daou.allapps.client;

import com.daou.allapps.dto.module.ModuleUploadResponseDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Appsmith 서버 API 클라이언트
 *
 * Appsmith 서버의 UIModule API를 호출합니다.
 */
@Slf4j
@Component
public class AppsmithApiClient {

    private static final String SERVICE_TOKEN_HEADER = "X-Service-Token";
    private static final String MODULE_API_PATH = "/all-apps/api/v1/modules";

    private final WebClient webClient;
    private final String serviceToken;

    public AppsmithApiClient(
            @Value("${appsmith.server.url:http://localhost:8080}") String serverUrl,
            @Value("${appsmith.service.token:}") String serviceToken) {
        this.serviceToken = serviceToken;
        this.webClient = WebClient.builder()
                .baseUrl(serverUrl)
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .build();
        log.info("AppsmithApiClient initialized with server URL: {}", serverUrl);
    }

    /**
     * 모든 모듈 목록 조회
     *
     * @return 모듈 목록
     */
    public Mono<List<Map<String, Object>>> getModules() {
        return webClient.get()
                .uri(MODULE_API_PATH)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<AppsmithResponse<List<Map<String, Object>>>>() {})
                .map(AppsmithResponse::getData)
                .timeout(Duration.ofSeconds(30))
                .doOnSuccess(modules -> log.debug("Fetched {} modules from Appsmith", modules != null ? modules.size() : 0))
                .doOnError(e -> log.error("Failed to fetch modules from Appsmith", e));
    }

    /**
     * 모듈 상세 조회
     *
     * @param moduleUuid 모듈 UUID
     * @return 모듈 상세
     */
    public Mono<Map<String, Object>> getModule(String moduleUuid) {
        return webClient.get()
                .uri(MODULE_API_PATH + "/{uuid}", moduleUuid)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<AppsmithResponse<Map<String, Object>>>() {})
                .map(AppsmithResponse::getData)
                .timeout(Duration.ofSeconds(30))
                .doOnSuccess(module -> log.debug("Fetched module {} from Appsmith", moduleUuid))
                .doOnError(e -> log.error("Failed to fetch module {} from Appsmith", moduleUuid, e));
    }

    /**
     * 모듈 생성/수정 (Upsert)
     *
     * @param moduleData 모듈 데이터 (UIModuleDTO 형식)
     * @return 저장된 모듈 정보
     */
    public Mono<ModuleUploadResponseDto.ModuleInfo> upsertModule(Map<String, Object> moduleData) {
        return webClient.post()
                .uri(MODULE_API_PATH + "/upsert")
                .header(SERVICE_TOKEN_HEADER, serviceToken)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(moduleData)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<AppsmithResponse<Map<String, Object>>>() {})
                .map(response -> mapToModuleInfo(response.getData()))
                .timeout(Duration.ofSeconds(30))
                .doOnSuccess(module -> log.info("Module upserted: {}", module.getModuleUUID()))
                .doOnError(e -> {
                    if (e instanceof WebClientResponseException) {
                        WebClientResponseException we = (WebClientResponseException) e;
                        log.error("Failed to upsert module to Appsmith: {} - {}",
                                we.getStatusCode(), we.getResponseBodyAsString());
                    } else {
                        log.error("Failed to upsert module to Appsmith", e);
                    }
                });
    }

    /**
     * 모듈 비활성화 (삭제)
     *
     * @param moduleUuid 모듈 UUID
     * @return 완료 신호
     */
    public Mono<Void> deleteModule(String moduleUuid) {
        return webClient.delete()
                .uri(MODULE_API_PATH + "/{uuid}", moduleUuid)
                .header(SERVICE_TOKEN_HEADER, serviceToken)
                .retrieve()
                .bodyToMono(Void.class)
                .timeout(Duration.ofSeconds(30))
                .doOnSuccess(v -> log.info("Module deleted: {}", moduleUuid))
                .doOnError(e -> log.error("Failed to delete module {} from Appsmith", moduleUuid, e));
    }

    /**
     * API 응답을 ModuleInfo로 변환
     */
    private ModuleUploadResponseDto.ModuleInfo mapToModuleInfo(Map<String, Object> data) {
        ModuleUploadResponseDto.ModuleInfo.ModuleInfoBuilder builder = ModuleUploadResponseDto.ModuleInfo.builder()
                .moduleUUID((String) data.get("moduleUUID"))
                .packageUUID((String) data.get("packageUUID"))
                .moduleName((String) data.get("moduleName"))
                .packageName((String) data.get("packageName"))
                .version((String) data.get("version"));

        // meta 필드 처리
        if (data.get("meta") instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> metaMap = (Map<String, Object>) data.get("meta");
            ModuleUploadResponseDto.ModuleMeta meta = ModuleUploadResponseDto.ModuleMeta.builder()
                    .icon((String) metaMap.get("icon"))
                    .color((String) metaMap.get("color"))
                    .description((String) metaMap.get("description"))
                    .tags(metaMap.get("tags") instanceof List ? (List<String>) metaMap.get("tags") : null)
                    .build();
            builder.meta(meta);
        }

        return builder.build();
    }

    /**
     * Appsmith API 응답 래퍼
     */
    private static class AppsmithResponse<T> {
        private ResponseMeta responseMeta;
        private T data;

        public T getData() {
            return data;
        }

        public void setData(T data) {
            this.data = data;
        }

        public ResponseMeta getResponseMeta() {
            return responseMeta;
        }

        public void setResponseMeta(ResponseMeta responseMeta) {
            this.responseMeta = responseMeta;
        }
    }

    private static class ResponseMeta {
        private int status;
        private String message;

        public int getStatus() {
            return status;
        }

        public void setStatus(int status) {
            this.status = status;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }
    }
}
