package com.daou.allapps.validator;

import com.daou.allapps.dto.module.ValidationResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * 모듈 JSON 스키마 검증기
 *
 * 모듈 JSON 파일의 필수 필드와 형식을 검증합니다.
 */
@Slf4j
@Component
public class ModuleSchemaValidator {

    /**
     * 시맨틱 버전 패턴 (예: 1.0.0, 2.1.3)
     */
    private static final Pattern VERSION_PATTERN = Pattern.compile("^\\d+\\.\\d+\\.\\d+$");

    /**
     * 모듈 JSON 검증
     *
     * @param moduleJson 모듈 JSON 데이터
     * @return 검증 결과
     */
    public ValidationResult validate(Map<String, Object> moduleJson) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        // 1. 필수 최상위 필드 검증
        validateRequiredField(moduleJson, "moduleUUID", errors);
        validateRequiredField(moduleJson, "packageUUID", errors);
        validateRequiredField(moduleJson, "moduleName", errors);
        validateRequiredField(moduleJson, "packageName", errors);
        validateRequiredField(moduleJson, "definition", errors);

        // 2. UUID 형식 검증
        validateUuidFormat(moduleJson, "moduleUUID", errors);
        validateUuidFormat(moduleJson, "packageUUID", errors);

        // 3. 버전 형식 검증 (선택 필드)
        if (moduleJson.containsKey("version")) {
            validateVersionFormat(moduleJson.get("version"), errors);
        }

        // 4. definition 구조 검증
        if (moduleJson.containsKey("definition") && moduleJson.get("definition") instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> definition = (Map<String, Object>) moduleJson.get("definition");
            validateDefinition(definition, errors, warnings);
        }

        // 5. meta 필드 검증 (선택적)
        if (moduleJson.containsKey("meta")) {
            if (!(moduleJson.get("meta") instanceof Map)) {
                warnings.add("meta field should be an object");
            } else {
                @SuppressWarnings("unchecked")
                Map<String, Object> meta = (Map<String, Object>) moduleJson.get("meta");
                validateMeta(meta, warnings);
            }
        } else {
            warnings.add("meta field is missing (optional)");
        }

        // 결과 반환
        if (errors.isEmpty()) {
            if (warnings.isEmpty()) {
                return ValidationResult.success();
            } else {
                return ValidationResult.successWithWarnings(warnings);
            }
        } else {
            return ValidationResult.failure(errors, warnings);
        }
    }

    /**
     * 필수 필드 존재 여부 검증
     */
    private void validateRequiredField(Map<String, Object> json, String fieldName, List<String> errors) {
        if (!json.containsKey(fieldName)) {
            errors.add(fieldName + " is required");
        } else if (json.get(fieldName) == null) {
            errors.add(fieldName + " cannot be null");
        } else if (json.get(fieldName) instanceof String && ((String) json.get(fieldName)).isBlank()) {
            errors.add(fieldName + " cannot be empty");
        }
    }

    /**
     * UUID 형식 검증
     */
    private void validateUuidFormat(Map<String, Object> json, String fieldName, List<String> errors) {
        Object value = json.get(fieldName);
        if (value instanceof String) {
            String uuidStr = (String) value;
            try {
                UUID.fromString(uuidStr);
            } catch (IllegalArgumentException e) {
                errors.add(fieldName + " must be a valid UUID format");
            }
        }
    }

    /**
     * 버전 형식 검증 (시맨틱 버전)
     */
    private void validateVersionFormat(Object version, List<String> errors) {
        if (version instanceof String) {
            String versionStr = (String) version;
            if (!VERSION_PATTERN.matcher(versionStr).matches()) {
                errors.add("version must be in semantic version format (e.g., 1.0.0)");
            }
        } else {
            errors.add("version must be a string");
        }
    }

    /**
     * definition 구조 검증
     */
    private void validateDefinition(Map<String, Object> definition, List<String> errors, List<String> warnings) {
        // 필수 필드
        if (!definition.containsKey("layouts")) {
            errors.add("definition.layouts is required");
        } else {
            validateLayouts(definition.get("layouts"), errors);
        }

        if (!definition.containsKey("inputsForm")) {
            errors.add("definition.inputsForm is required");
        }

        if (!definition.containsKey("outputsForm")) {
            errors.add("definition.outputsForm is required");
        }

        // 선택적 필드 검증
        if (!definition.containsKey("actionList")) {
            warnings.add("definition.actionList is missing (optional)");
        }

        if (!definition.containsKey("actionCollectionList")) {
            warnings.add("definition.actionCollectionList is missing (optional)");
        }
    }

    /**
     * layouts 구조 검증
     */
    private void validateLayouts(Object layouts, List<String> errors) {
        if (!(layouts instanceof List)) {
            errors.add("definition.layouts must be an array");
            return;
        }

        @SuppressWarnings("unchecked")
        List<Object> layoutList = (List<Object>) layouts;
        if (layoutList.isEmpty()) {
            errors.add("definition.layouts must contain at least one layout");
            return;
        }

        // 첫 번째 레이아웃의 dsl 검증
        Object firstLayout = layoutList.get(0);
        if (firstLayout instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> layout = (Map<String, Object>) firstLayout;
            if (!layout.containsKey("dsl")) {
                errors.add("definition.layouts[0].dsl is required");
            }
        } else {
            errors.add("definition.layouts[0] must be an object");
        }
    }

    /**
     * meta 필드 검증 (경고만 발생)
     */
    private void validateMeta(Map<String, Object> meta, List<String> warnings) {
        if (!meta.containsKey("icon")) {
            warnings.add("meta.icon is missing (recommended)");
        }

        if (!meta.containsKey("description")) {
            warnings.add("meta.description is missing (recommended)");
        }
    }
}
