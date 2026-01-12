package com.daou.allapps.service;

import com.daou.allapps.client.AppsmithApiClient;
import com.daou.allapps.dto.module.ModuleUploadResponseDto;
import com.daou.allapps.dto.module.ValidationResult;
import com.daou.allapps.validator.ModuleSchemaValidator;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * ModuleService 단위 테스트
 */
@ExtendWith(MockitoExtension.class)
public class ModuleServiceTest {

    @Mock
    private ModuleSchemaValidator schemaValidator;

    @Mock
    private AppsmithApiClient appsmithApiClient;

    private ObjectMapper objectMapper;
    private ModuleService moduleService;

    private String testModuleUuid;
    private String testPackageUuid;

    @BeforeEach
    public void setup() {
        objectMapper = new ObjectMapper();
        moduleService = new ModuleService(schemaValidator, appsmithApiClient, objectMapper);

        testModuleUuid = UUID.randomUUID().toString();
        testPackageUuid = UUID.randomUUID().toString();
    }

    /**
     * 유효한 모듈 JSON 생성 헬퍼
     */
    private Map<String, Object> createValidModuleJson() {
        Map<String, Object> moduleJson = new HashMap<>();
        moduleJson.put("moduleUUID", testModuleUuid);
        moduleJson.put("packageUUID", testPackageUuid);
        moduleJson.put("moduleName", "TestModule");
        moduleJson.put("packageName", "TestPackage");
        moduleJson.put("version", "1.0.0");

        Map<String, Object> definition = new HashMap<>();
        List<Map<String, Object>> layouts = new ArrayList<>();
        Map<String, Object> layout = new HashMap<>();
        layout.put("dsl", new HashMap<>());
        layouts.add(layout);
        definition.put("layouts", layouts);
        definition.put("inputsForm", new ArrayList<>());
        definition.put("outputsForm", new ArrayList<>());

        moduleJson.put("definition", definition);

        return moduleJson;
    }

    private MultipartFile createMockFile(Map<String, Object> content) throws Exception {
        String json = objectMapper.writeValueAsString(content);
        return new MockMultipartFile(
                "file",
                "test-module.json",
                "application/json",
                json.getBytes()
        );
    }

    @Test
    public void testUploadModule_Success() throws Exception {
        Map<String, Object> moduleJson = createValidModuleJson();
        MultipartFile file = createMockFile(moduleJson);

        // 검증 성공 모킹
        when(schemaValidator.validate(anyMap()))
                .thenReturn(ValidationResult.success());

        // API 호출 모킹
        ModuleUploadResponseDto.ModuleInfo moduleInfo = new ModuleUploadResponseDto.ModuleInfo();
        moduleInfo.setModuleUUID(testModuleUuid);
        moduleInfo.setModuleName("TestModule");
        moduleInfo.setVersion("1.0.0");
        when(appsmithApiClient.upsertModule(anyMap()))
                .thenReturn(Mono.just(moduleInfo));

        ModuleUploadResponseDto result = moduleService.uploadModule(file, null, null);

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.getModuleInfo()).isNotNull();
        assertThat(result.getModuleInfo().getModuleUUID()).isEqualTo(testModuleUuid);
        verify(appsmithApiClient).upsertModule(anyMap());
    }

    @Test
    public void testUploadModule_ValidationFailed() throws Exception {
        Map<String, Object> moduleJson = createValidModuleJson();
        moduleJson.remove("moduleUUID"); // 필수 필드 제거
        MultipartFile file = createMockFile(moduleJson);

        // 검증 실패 모킹
        when(schemaValidator.validate(anyMap()))
                .thenReturn(ValidationResult.failure(List.of("moduleUUID is required")));

        ModuleUploadResponseDto result = moduleService.uploadModule(file, null, null);

        assertThat(result.isSuccess()).isFalse();
        assertThat(result.getValidation().getErrors()).contains("moduleUUID is required");
        verify(appsmithApiClient, never()).upsertModule(any());
    }

    @Test
    public void testUploadModule_WithVersion() throws Exception {
        Map<String, Object> moduleJson = createValidModuleJson();
        MultipartFile file = createMockFile(moduleJson);

        when(schemaValidator.validate(anyMap()))
                .thenReturn(ValidationResult.success());

        ModuleUploadResponseDto.ModuleInfo moduleInfo = new ModuleUploadResponseDto.ModuleInfo();
        moduleInfo.setModuleUUID(testModuleUuid);
        moduleInfo.setVersion("2.0.0");
        when(appsmithApiClient.upsertModule(anyMap()))
                .thenReturn(Mono.just(moduleInfo));

        ModuleUploadResponseDto result = moduleService.uploadModule(file, "2.0.0", "Version bump");

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.getModuleInfo().getVersion()).isEqualTo("2.0.0");
    }

    @Test
    public void testUploadModule_InvalidJson() {
        MultipartFile file = new MockMultipartFile(
                "file",
                "invalid.json",
                "application/json",
                "{ invalid json }".getBytes()
        );

        ModuleUploadResponseDto result = moduleService.uploadModule(file, null, null);

        assertThat(result.isSuccess()).isFalse();
        assertThat(result.getErrorMessage()).contains("Failed to parse JSON file");
    }

    @Test
    public void testUploadModule_ApiCallFailed() throws Exception {
        Map<String, Object> moduleJson = createValidModuleJson();
        MultipartFile file = createMockFile(moduleJson);

        when(schemaValidator.validate(anyMap()))
                .thenReturn(ValidationResult.success());
        when(appsmithApiClient.upsertModule(anyMap()))
                .thenReturn(Mono.empty());

        ModuleUploadResponseDto result = moduleService.uploadModule(file, null, null);

        assertThat(result.isSuccess()).isFalse();
        assertThat(result.getErrorMessage()).contains("Failed to save module to Appsmith server");
    }

    @Test
    public void testValidateModule_Success() throws Exception {
        Map<String, Object> moduleJson = createValidModuleJson();
        MultipartFile file = createMockFile(moduleJson);

        when(schemaValidator.validate(anyMap()))
                .thenReturn(ValidationResult.success());

        ValidationResult result = moduleService.validateModule(file);

        assertThat(result.isValid()).isTrue();
    }

    @Test
    public void testValidateModule_Failure() throws Exception {
        Map<String, Object> moduleJson = new HashMap<>();
        MultipartFile file = createMockFile(moduleJson);

        when(schemaValidator.validate(anyMap()))
                .thenReturn(ValidationResult.failure(List.of("moduleUUID is required")));

        ValidationResult result = moduleService.validateModule(file);

        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrors()).contains("moduleUUID is required");
    }

    @Test
    public void testValidateModule_InvalidJson() {
        MultipartFile file = new MockMultipartFile(
                "file",
                "invalid.json",
                "application/json",
                "not json".getBytes()
        );

        ValidationResult result = moduleService.validateModule(file);

        assertThat(result.isValid()).isFalse();
        assertThat(result.getErrors().get(0)).contains("Invalid JSON format");
    }

    @Test
    public void testGetModules_Success() {
        List<Map<String, Object>> mockModules = new ArrayList<>();
        Map<String, Object> module = new HashMap<>();
        module.put("moduleUUID", testModuleUuid);
        module.put("moduleName", "TestModule");
        mockModules.add(module);

        when(appsmithApiClient.getModules())
                .thenReturn(Mono.just(mockModules));

        List<Map<String, Object>> result = moduleService.getModules();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).get("moduleUUID")).isEqualTo(testModuleUuid);
    }

    @Test
    public void testGetModule_Success() {
        Map<String, Object> mockModule = new HashMap<>();
        mockModule.put("moduleUUID", testModuleUuid);
        mockModule.put("moduleName", "TestModule");
        mockModule.put("definition", new HashMap<>());

        when(appsmithApiClient.getModule(testModuleUuid))
                .thenReturn(Mono.just(mockModule));

        Map<String, Object> result = moduleService.getModule(testModuleUuid);

        assertThat(result.get("moduleUUID")).isEqualTo(testModuleUuid);
        assertThat(result.get("definition")).isNotNull();
    }

    @Test
    public void testDeleteModule_Success() {
        when(appsmithApiClient.deleteModule(testModuleUuid))
                .thenReturn(Mono.empty());

        moduleService.deleteModule(testModuleUuid);

        verify(appsmithApiClient).deleteModule(testModuleUuid);
    }

    @Test
    public void testUploadModule_WithWarnings() throws Exception {
        Map<String, Object> moduleJson = createValidModuleJson();
        MultipartFile file = createMockFile(moduleJson);

        // 경고와 함께 검증 성공 모킹
        when(schemaValidator.validate(anyMap()))
                .thenReturn(ValidationResult.successWithWarnings(List.of("meta.icon is missing")));

        ModuleUploadResponseDto.ModuleInfo moduleInfo = new ModuleUploadResponseDto.ModuleInfo();
        moduleInfo.setModuleUUID(testModuleUuid);
        moduleInfo.setVersion("1.0.0");
        when(appsmithApiClient.upsertModule(anyMap()))
                .thenReturn(Mono.just(moduleInfo));

        ModuleUploadResponseDto result = moduleService.uploadModule(file, null, null);

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.getValidation().getWarnings()).contains("meta.icon is missing");
    }
}
