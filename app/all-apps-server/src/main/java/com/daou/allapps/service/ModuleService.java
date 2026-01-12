package com.daou.allapps.service;

import com.daou.allapps.client.AppsmithApiClient;
import com.daou.allapps.dto.module.ModuleUploadResponseDto;
import com.daou.allapps.dto.module.ValidationResult;
import com.daou.allapps.validator.ModuleSchemaValidator;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Mono;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 모듈 업로드 서비스
 *
 * 모듈 JSON 파일을 파싱, 검증하고 Appsmith 서버에 업로드합니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ModuleService {

    private final ModuleSchemaValidator schemaValidator;
    private final AppsmithApiClient appsmithApiClient;
    private final ObjectMapper objectMapper;

    /**
     * 모듈 파일 업로드
     *
     * @param file     JSON 파일
     * @param version  버전 (선택)
     * @param changeLog 변경 이력 (선택)
     * @return 업로드 결과
     */
    public ModuleUploadResponseDto uploadModule(MultipartFile file, String version, String changeLog) {
        try {
            // 1. JSON 파싱
            Map<String, Object> moduleJson = parseJsonFile(file);

            // 2. 스키마 검증
            ValidationResult validation = schemaValidator.validate(moduleJson);
            if (!validation.isValid()) {
                log.warn("Module validation failed: {}", validation.getErrors());
                return ModuleUploadResponseDto.validationFailed(validation);
            }

            // 3. 버전 설정 (요청에 포함된 경우)
            if (version != null && !version.isBlank()) {
                moduleJson.put("version", version);
            }

            // 4. Appsmith API 호출을 위한 DTO 변환
            Map<String, Object> apiRequest = convertToApiRequest(moduleJson);

            // 5. Appsmith API 호출
            ModuleUploadResponseDto.ModuleInfo moduleInfo = appsmithApiClient
                    .upsertModule(apiRequest)
                    .block();

            if (moduleInfo == null) {
                return ModuleUploadResponseDto.failure("Failed to save module to Appsmith server", validation);
            }

            log.info("Module uploaded successfully: moduleUUID={}, version={}",
                    moduleInfo.getModuleUUID(), moduleInfo.getVersion());

            return ModuleUploadResponseDto.success(moduleInfo, validation);

        } catch (IOException e) {
            log.error("Failed to parse module JSON file", e);
            return ModuleUploadResponseDto.failure(
                    "Failed to parse JSON file: " + e.getMessage(),
                    ValidationResult.failure(List.of("Invalid JSON format")));
        } catch (Exception e) {
            log.error("Failed to upload module", e);
            return ModuleUploadResponseDto.failure(
                    "Failed to upload module: " + e.getMessage(),
                    ValidationResult.failure(List.of(e.getMessage())));
        }
    }

    /**
     * 모듈 JSON 스키마 검증만 수행
     *
     * @param file JSON 파일
     * @return 검증 결과
     */
    public ValidationResult validateModule(MultipartFile file) {
        try {
            Map<String, Object> moduleJson = parseJsonFile(file);
            return schemaValidator.validate(moduleJson);
        } catch (IOException e) {
            log.error("Failed to parse module JSON file for validation", e);
            return ValidationResult.failure(List.of("Invalid JSON format: " + e.getMessage()));
        }
    }

    /**
     * 모듈 목록 조회 (프록시)
     *
     * @return 모듈 목록
     */
    public List<Map<String, Object>> getModules() {
        return appsmithApiClient.getModules().block();
    }

    /**
     * 모듈 상세 조회 (프록시)
     *
     * @param moduleUuid 모듈 UUID
     * @return 모듈 상세
     */
    public Map<String, Object> getModule(String moduleUuid) {
        return appsmithApiClient.getModule(moduleUuid).block();
    }

    /**
     * 모듈 삭제 (프록시)
     *
     * @param moduleUuid 모듈 UUID
     */
    public void deleteModule(String moduleUuid) {
        appsmithApiClient.deleteModule(moduleUuid).block();
    }

    /**
     * JSON 파일 파싱
     */
    private Map<String, Object> parseJsonFile(MultipartFile file) throws IOException {
        return objectMapper.readValue(file.getInputStream(), new TypeReference<Map<String, Object>>() {});
    }

    /**
     * 모듈 JSON을 API 요청 형식으로 변환
     *
     * 클라이언트 JSON 형식을 서버 API DTO 형식으로 변환합니다.
     * - moduleUUID -> moduleUUID
     * - packageUUID -> packageUUID
     * - moduleName -> moduleName
     * - packageName -> packageName
     * - version -> version
     * - meta -> meta
     * - 나머지 -> definition
     */
    private Map<String, Object> convertToApiRequest(Map<String, Object> moduleJson) {
        Map<String, Object> apiRequest = new HashMap<>();

        // 최상위 필드 복사
        apiRequest.put("moduleUUID", moduleJson.get("moduleUUID"));
        apiRequest.put("packageUUID", moduleJson.get("packageUUID"));
        apiRequest.put("moduleName", moduleJson.get("moduleName"));
        apiRequest.put("packageName", moduleJson.get("packageName"));

        if (moduleJson.containsKey("version")) {
            apiRequest.put("version", moduleJson.get("version"));
        }

        if (moduleJson.containsKey("meta")) {
            apiRequest.put("meta", moduleJson.get("meta"));
        }

        // definition 필드 구성
        // 이미 definition 필드가 있으면 그대로 사용
        if (moduleJson.containsKey("definition")) {
            apiRequest.put("definition", moduleJson.get("definition"));
        } else {
            // 없으면 나머지 필드들로 definition 구성 (레거시 지원)
            Map<String, Object> definition = new HashMap<>();
            if (moduleJson.containsKey("layouts")) {
                definition.put("layouts", moduleJson.get("layouts"));
            }
            if (moduleJson.containsKey("inputsForm")) {
                definition.put("inputsForm", moduleJson.get("inputsForm"));
            }
            if (moduleJson.containsKey("outputsForm")) {
                definition.put("outputsForm", moduleJson.get("outputsForm"));
            }
            if (moduleJson.containsKey("actionList")) {
                definition.put("actionList", moduleJson.get("actionList"));
            }
            if (moduleJson.containsKey("actionCollectionList")) {
                definition.put("actionCollectionList", moduleJson.get("actionCollectionList"));
            }
            apiRequest.put("definition", definition);
        }

        return apiRequest;
    }
}
