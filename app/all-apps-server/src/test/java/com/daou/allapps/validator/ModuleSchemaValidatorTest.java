package com.daou.allapps.validator;

import com.daou.allapps.dto.module.ValidationResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ModuleSchemaValidator 단위 테스트
 */
public class ModuleSchemaValidatorTest {

    private ModuleSchemaValidator validator;

    @BeforeEach
    public void setup() {
        validator = new ModuleSchemaValidator();
    }

    /**
     * 유효한 모듈 JSON 생성 헬퍼
     */
    private Map<String, Object> createValidModuleJson() {
        Map<String, Object> moduleJson = new HashMap<>();
        moduleJson.put("moduleUUID", UUID.randomUUID().toString());
        moduleJson.put("packageUUID", UUID.randomUUID().toString());
        moduleJson.put("moduleName", "TestModule");
        moduleJson.put("packageName", "TestPackage");
        moduleJson.put("version", "1.0.0");

        // definition 구조
        Map<String, Object> definition = new HashMap<>();

        // layouts (배열)
        List<Map<String, Object>> layouts = new ArrayList<>();
        Map<String, Object> layout = new HashMap<>();
        Map<String, Object> dsl = new HashMap<>();
        dsl.put("widgetName", "Canvas");
        dsl.put("type", "CANVAS_WIDGET");
        layout.put("dsl", dsl);
        layouts.add(layout);
        definition.put("layouts", layouts);

        definition.put("inputsForm", new ArrayList<>());
        definition.put("outputsForm", new ArrayList<>());
        definition.put("actionList", new ArrayList<>());
        definition.put("actionCollectionList", new ArrayList<>());

        moduleJson.put("definition", definition);

        // meta (선택)
        Map<String, Object> meta = new HashMap<>();
        meta.put("icon", "test-icon");
        meta.put("color", "#FF0000");
        meta.put("description", "Test module");
        moduleJson.put("meta", meta);

        return moduleJson;
    }

    @Test
    public void testValidModule_Success() {
        Map<String, Object> moduleJson = createValidModuleJson();

        ValidationResult result = validator.validate(moduleJson);

        assertThat(result.isValid()).isTrue();
        assertThat(result.getErrors()).isEmpty();
    }

    @Test
    public void testMissingModuleUUID_Failure() {
        Map<String, Object> moduleJson = createValidModuleJson();
        moduleJson.remove("moduleUUID");

        ValidationResult result = validator.validate(moduleJson);

        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrors()).contains("moduleUUID is required");
    }

    @Test
    public void testMissingPackageUUID_Failure() {
        Map<String, Object> moduleJson = createValidModuleJson();
        moduleJson.remove("packageUUID");

        ValidationResult result = validator.validate(moduleJson);

        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrors()).contains("packageUUID is required");
    }

    @Test
    public void testMissingModuleName_Failure() {
        Map<String, Object> moduleJson = createValidModuleJson();
        moduleJson.remove("moduleName");

        ValidationResult result = validator.validate(moduleJson);

        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrors()).contains("moduleName is required");
    }

    @Test
    public void testMissingPackageName_Failure() {
        Map<String, Object> moduleJson = createValidModuleJson();
        moduleJson.remove("packageName");

        ValidationResult result = validator.validate(moduleJson);

        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrors()).contains("packageName is required");
    }

    @Test
    public void testMissingDefinition_Failure() {
        Map<String, Object> moduleJson = createValidModuleJson();
        moduleJson.remove("definition");

        ValidationResult result = validator.validate(moduleJson);

        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrors()).contains("definition is required");
    }

    @Test
    public void testInvalidModuleUUID_Failure() {
        Map<String, Object> moduleJson = createValidModuleJson();
        moduleJson.put("moduleUUID", "invalid-uuid");

        ValidationResult result = validator.validate(moduleJson);

        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrors()).contains("moduleUUID must be a valid UUID format");
    }

    @Test
    public void testInvalidPackageUUID_Failure() {
        Map<String, Object> moduleJson = createValidModuleJson();
        moduleJson.put("packageUUID", "not-a-uuid");

        ValidationResult result = validator.validate(moduleJson);

        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrors()).contains("packageUUID must be a valid UUID format");
    }

    @Test
    public void testInvalidVersion_Failure() {
        Map<String, Object> moduleJson = createValidModuleJson();
        moduleJson.put("version", "1.0");

        ValidationResult result = validator.validate(moduleJson);

        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrors()).contains("version must be in semantic version format (e.g., 1.0.0)");
    }

    @Test
    public void testValidVersion_Success() {
        Map<String, Object> moduleJson = createValidModuleJson();
        moduleJson.put("version", "2.1.3");

        ValidationResult result = validator.validate(moduleJson);

        assertThat(result.isValid()).isTrue();
    }

    @Test
    public void testMissingLayouts_Failure() {
        Map<String, Object> moduleJson = createValidModuleJson();
        @SuppressWarnings("unchecked")
        Map<String, Object> definition = (Map<String, Object>) moduleJson.get("definition");
        definition.remove("layouts");

        ValidationResult result = validator.validate(moduleJson);

        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrors()).contains("definition.layouts is required");
    }

    @Test
    public void testEmptyLayouts_Failure() {
        Map<String, Object> moduleJson = createValidModuleJson();
        @SuppressWarnings("unchecked")
        Map<String, Object> definition = (Map<String, Object>) moduleJson.get("definition");
        definition.put("layouts", new ArrayList<>());

        ValidationResult result = validator.validate(moduleJson);

        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrors()).contains("definition.layouts must contain at least one layout");
    }

    @Test
    public void testMissingDslInLayouts_Failure() {
        Map<String, Object> moduleJson = createValidModuleJson();
        @SuppressWarnings("unchecked")
        Map<String, Object> definition = (Map<String, Object>) moduleJson.get("definition");

        List<Map<String, Object>> layouts = new ArrayList<>();
        Map<String, Object> layout = new HashMap<>();
        // dsl 필드 없음
        layouts.add(layout);
        definition.put("layouts", layouts);

        ValidationResult result = validator.validate(moduleJson);

        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrors()).contains("definition.layouts[0].dsl is required");
    }

    @Test
    public void testMissingInputsForm_Failure() {
        Map<String, Object> moduleJson = createValidModuleJson();
        @SuppressWarnings("unchecked")
        Map<String, Object> definition = (Map<String, Object>) moduleJson.get("definition");
        definition.remove("inputsForm");

        ValidationResult result = validator.validate(moduleJson);

        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrors()).contains("definition.inputsForm is required");
    }

    @Test
    public void testMissingOutputsForm_Failure() {
        Map<String, Object> moduleJson = createValidModuleJson();
        @SuppressWarnings("unchecked")
        Map<String, Object> definition = (Map<String, Object>) moduleJson.get("definition");
        definition.remove("outputsForm");

        ValidationResult result = validator.validate(moduleJson);

        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrors()).contains("definition.outputsForm is required");
    }

    @Test
    public void testMissingMeta_Warning() {
        Map<String, Object> moduleJson = createValidModuleJson();
        moduleJson.remove("meta");

        ValidationResult result = validator.validate(moduleJson);

        assertThat(result.isValid()).isTrue();
        assertThat(result.getWarnings()).contains("meta field is missing (optional)");
    }

    @Test
    public void testMissingActionList_Warning() {
        Map<String, Object> moduleJson = createValidModuleJson();
        @SuppressWarnings("unchecked")
        Map<String, Object> definition = (Map<String, Object>) moduleJson.get("definition");
        definition.remove("actionList");

        ValidationResult result = validator.validate(moduleJson);

        assertThat(result.isValid()).isTrue();
        assertThat(result.getWarnings()).contains("definition.actionList is missing (optional)");
    }

    @Test
    public void testMissingMetaIcon_Warning() {
        Map<String, Object> moduleJson = createValidModuleJson();
        @SuppressWarnings("unchecked")
        Map<String, Object> meta = (Map<String, Object>) moduleJson.get("meta");
        meta.remove("icon");

        ValidationResult result = validator.validate(moduleJson);

        assertThat(result.isValid()).isTrue();
        assertThat(result.getWarnings()).contains("meta.icon is missing (recommended)");
    }

    @Test
    public void testNullModuleName_Failure() {
        Map<String, Object> moduleJson = createValidModuleJson();
        moduleJson.put("moduleName", null);

        ValidationResult result = validator.validate(moduleJson);

        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrors()).contains("moduleName cannot be null");
    }

    @Test
    public void testEmptyModuleName_Failure() {
        Map<String, Object> moduleJson = createValidModuleJson();
        moduleJson.put("moduleName", "   ");

        ValidationResult result = validator.validate(moduleJson);

        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrors()).contains("moduleName cannot be empty");
    }

    @Test
    public void testMultipleErrors() {
        Map<String, Object> moduleJson = new HashMap<>();
        // 모든 필수 필드 누락

        ValidationResult result = validator.validate(moduleJson);

        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrors()).containsExactlyInAnyOrder(
                "moduleUUID is required",
                "packageUUID is required",
                "moduleName is required",
                "packageName is required",
                "definition is required"
        );
    }
}
