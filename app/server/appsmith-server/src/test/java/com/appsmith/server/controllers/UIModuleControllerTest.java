package com.appsmith.server.controllers;

import com.appsmith.server.constants.Url;
import com.appsmith.server.dtos.UIModuleDTO;
import com.appsmith.server.dtos.UIModuleListDTO;
import com.appsmith.server.dtos.UIModuleMetaDTO;
import com.appsmith.server.dtos.UIModuleResponseDTO;
import com.appsmith.server.services.UIModuleService;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.WebFluxTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * UIModuleController 통합 테스트
 */
@Slf4j
@WebFluxTest(controllers = UIModuleController.class)
public class UIModuleControllerTest {

    @Autowired
    private WebTestClient webTestClient;

    @MockBean
    private UIModuleService uiModuleService;

    private UIModuleListDTO testListDTO;
    private UIModuleResponseDTO testResponseDTO;
    private String testModuleUuid;

    @BeforeEach
    public void setup() {
        testModuleUuid = UUID.randomUUID().toString();

        // 테스트용 목록 DTO 생성
        testListDTO = new UIModuleListDTO();
        testListDTO.setModuleUUID(testModuleUuid);
        testListDTO.setPackageUUID(UUID.randomUUID().toString());
        testListDTO.setModuleName("TestModule");
        testListDTO.setPackageName("TestPackage");
        testListDTO.setVersion("1.0.0");

        UIModuleMetaDTO meta = new UIModuleMetaDTO();
        meta.setIcon("icon-test");
        meta.setColor("#FF0000");
        testListDTO.setMeta(meta);

        // 테스트용 응답 DTO 생성
        testResponseDTO = new UIModuleResponseDTO();
        testResponseDTO.setId("test-id");
        testResponseDTO.setModuleUUID(testModuleUuid);
        testResponseDTO.setPackageUUID(UUID.randomUUID().toString());
        testResponseDTO.setModuleName("TestModule");
        testResponseDTO.setPackageName("TestPackage");
        testResponseDTO.setVersion("1.0.0");
        testResponseDTO.setMeta(meta);
        testResponseDTO.setCreatedAt(Instant.now());
        testResponseDTO.setUpdatedAt(Instant.now());

        Map<String, Object> definition = new HashMap<>();
        definition.put("layouts", new Object[] {});
        definition.put("inputsForm", new Object[] {});
        definition.put("outputsForm", new Object[] {});
        testResponseDTO.setDefinition(definition);
    }

    @Test
    public void testGetAllModules() {
        when(uiModuleService.getAllModules()).thenReturn(Flux.just(testListDTO));

        webTestClient
                .get()
                .uri(Url.UI_MODULE_URL)
                .accept(MediaType.APPLICATION_JSON)
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody()
                .jsonPath("$.responseMeta.status")
                .isEqualTo(200)
                .jsonPath("$.data")
                .isArray()
                .jsonPath("$.data[0].moduleUUID")
                .isEqualTo(testModuleUuid)
                .jsonPath("$.data[0].moduleName")
                .isEqualTo("TestModule");
    }

    @Test
    public void testGetModuleByUuid() {
        when(uiModuleService.getModuleByUuid(eq(testModuleUuid))).thenReturn(Mono.just(testResponseDTO));

        webTestClient
                .get()
                .uri(Url.UI_MODULE_URL + "/{uuid}", testModuleUuid)
                .accept(MediaType.APPLICATION_JSON)
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody()
                .jsonPath("$.responseMeta.status")
                .isEqualTo(200)
                .jsonPath("$.data.moduleUUID")
                .isEqualTo(testModuleUuid)
                .jsonPath("$.data.moduleName")
                .isEqualTo("TestModule")
                .jsonPath("$.data.definition")
                .exists();
    }

    @Test
    public void testUpsertModule() {
        UIModuleDTO requestDTO = new UIModuleDTO();
        requestDTO.setModuleUUID(testModuleUuid);
        requestDTO.setPackageUUID(UUID.randomUUID().toString());
        requestDTO.setModuleName("TestModule");
        requestDTO.setPackageName("TestPackage");
        requestDTO.setVersion("1.0.0");

        Map<String, Object> definition = new HashMap<>();
        definition.put("layouts", new Object[] {});
        requestDTO.setDefinition(definition);

        when(uiModuleService.upsertModule(any(UIModuleDTO.class))).thenReturn(Mono.just(testResponseDTO));

        webTestClient
                .post()
                .uri(Url.UI_MODULE_URL + "/upsert")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(requestDTO)
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody()
                .jsonPath("$.responseMeta.status")
                .isEqualTo(200)
                .jsonPath("$.data.moduleUUID")
                .isEqualTo(testModuleUuid);
    }

    @Test
    public void testDeleteModule() {
        when(uiModuleService.disableModule(eq(testModuleUuid))).thenReturn(Mono.empty());

        webTestClient
                .delete()
                .uri(Url.UI_MODULE_URL + "/{uuid}", testModuleUuid)
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody()
                .jsonPath("$.responseMeta.status")
                .isEqualTo(200);
    }

    @Test
    public void testGetAllModules_Empty() {
        when(uiModuleService.getAllModules()).thenReturn(Flux.empty());

        webTestClient
                .get()
                .uri(Url.UI_MODULE_URL)
                .accept(MediaType.APPLICATION_JSON)
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody()
                .jsonPath("$.data")
                .isArray()
                .jsonPath("$.data")
                .isEmpty();
    }

    @Test
    public void testGetModuleByUuid_WithMeta() {
        when(uiModuleService.getModuleByUuid(eq(testModuleUuid))).thenReturn(Mono.just(testResponseDTO));

        webTestClient
                .get()
                .uri(Url.UI_MODULE_URL + "/{uuid}", testModuleUuid)
                .accept(MediaType.APPLICATION_JSON)
                .exchange()
                .expectStatus()
                .isOk()
                .expectBody()
                .jsonPath("$.data.meta.icon")
                .isEqualTo("icon-test")
                .jsonPath("$.data.meta.color")
                .isEqualTo("#FF0000");
    }
}
