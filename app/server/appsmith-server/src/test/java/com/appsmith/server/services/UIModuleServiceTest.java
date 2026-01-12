package com.appsmith.server.services;

import com.appsmith.server.domains.UIModule;
import com.appsmith.server.dtos.UIModuleDTO;
import com.appsmith.server.dtos.UIModuleListDTO;
import com.appsmith.server.dtos.UIModuleMetaDTO;
import com.appsmith.server.dtos.UIModuleResponseDTO;
import com.appsmith.server.exceptions.AppsmithException;
import com.appsmith.server.repositories.UIModuleRepository;
import com.appsmith.server.services.ce.UIModuleServiceCEImpl;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * UIModuleService 단위 테스트
 */
@Slf4j
@ExtendWith(MockitoExtension.class)
public class UIModuleServiceTest {

    @Mock
    private UIModuleRepository repository;

    private UIModuleServiceCEImpl service;

    private UIModule testModule;
    private UIModuleDTO testDTO;
    private String testModuleUuid;

    @BeforeEach
    public void setup() {
        service = new UIModuleServiceCEImpl(repository);

        testModuleUuid = UUID.randomUUID().toString();

        // 테스트용 모듈 생성
        testModule = new UIModule();
        testModule.setId("test-id");
        testModule.setModuleUuid(testModuleUuid);
        testModule.setPackageUuid(UUID.randomUUID().toString());
        testModule.setModuleName("TestModule");
        testModule.setPackageName("TestPackage");
        testModule.setVersion("1.0.0");
        testModule.setEnabled(true);

        Map<String, Object> definition = new HashMap<>();
        definition.put("layouts", new Object[] {});
        definition.put("inputsForm", new Object[] {});
        definition.put("outputsForm", new Object[] {});
        testModule.setDefinition(definition);

        UIModule.UIModuleMeta meta = new UIModule.UIModuleMeta();
        meta.setIcon("icon-test");
        meta.setColor("#FF0000");
        testModule.setMeta(meta);

        // 테스트용 DTO 생성
        testDTO = new UIModuleDTO();
        testDTO.setModuleUUID(testModuleUuid);
        testDTO.setPackageUUID(UUID.randomUUID().toString());
        testDTO.setModuleName("TestModule");
        testDTO.setPackageName("TestPackage");
        testDTO.setVersion("1.0.0");
        testDTO.setDefinition(definition);

        UIModuleMetaDTO metaDTO = new UIModuleMetaDTO();
        metaDTO.setIcon("icon-test");
        metaDTO.setColor("#FF0000");
        testDTO.setMeta(metaDTO);
    }

    @Test
    public void testGetAllModules_ReturnsEnabledModules() {
        when(repository.findAllByEnabledTrue()).thenReturn(Flux.just(testModule));

        StepVerifier.create(service.getAllModules())
                .assertNext(dto -> {
                    assertThat(dto).isInstanceOf(UIModuleListDTO.class);
                    assertThat(dto.getModuleUUID()).isEqualTo(testModuleUuid);
                    assertThat(dto.getModuleName()).isEqualTo("TestModule");
                    assertThat(dto.getPackageName()).isEqualTo("TestPackage");
                    assertThat(dto.getVersion()).isEqualTo("1.0.0");
                })
                .verifyComplete();
    }

    @Test
    public void testGetAllModules_ReturnsEmpty() {
        when(repository.findAllByEnabledTrue()).thenReturn(Flux.empty());

        StepVerifier.create(service.getAllModules()).verifyComplete();
    }

    @Test
    public void testGetModuleByUuid_Found() {
        when(repository.findByModuleUuidAndEnabledTrue(testModuleUuid)).thenReturn(Mono.just(testModule));

        StepVerifier.create(service.getModuleByUuid(testModuleUuid))
                .assertNext(dto -> {
                    assertThat(dto).isInstanceOf(UIModuleResponseDTO.class);
                    assertThat(dto.getModuleUUID()).isEqualTo(testModuleUuid);
                    assertThat(dto.getModuleName()).isEqualTo("TestModule");
                    assertThat(dto.getDefinition()).isNotNull();
                })
                .verifyComplete();
    }

    @Test
    public void testGetModuleByUuid_NotFound() {
        when(repository.findByModuleUuidAndEnabledTrue(anyString())).thenReturn(Mono.empty());

        StepVerifier.create(service.getModuleByUuid("non-existent-uuid"))
                .expectError(AppsmithException.class)
                .verify();
    }

    @Test
    public void testUpsertModule_CreateNew() {
        when(repository.findByModuleUuid(testDTO.getModuleUUID())).thenReturn(Mono.empty());
        when(repository.save(any(UIModule.class))).thenAnswer(invocation -> {
            UIModule module = invocation.getArgument(0);
            module.setId("new-id");
            return Mono.just(module);
        });

        StepVerifier.create(service.upsertModule(testDTO))
                .assertNext(dto -> {
                    assertThat(dto).isInstanceOf(UIModuleResponseDTO.class);
                    assertThat(dto.getModuleUUID()).isEqualTo(testDTO.getModuleUUID());
                    assertThat(dto.getModuleName()).isEqualTo("TestModule");
                    assertThat(dto.getVersion()).isEqualTo("1.0.0");
                })
                .verifyComplete();
    }

    @Test
    public void testUpsertModule_UpdateExisting() {
        when(repository.findByModuleUuid(testModuleUuid)).thenReturn(Mono.just(testModule));
        when(repository.save(any(UIModule.class))).thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));

        // 업데이트할 DTO (버전 동일)
        testDTO.setVersion("1.0.0");

        StepVerifier.create(service.upsertModule(testDTO))
                .assertNext(dto -> {
                    assertThat(dto).isInstanceOf(UIModuleResponseDTO.class);
                    assertThat(dto.getModuleUUID()).isEqualTo(testModuleUuid);
                    // 버전이 자동 증가되어야 함
                    assertThat(dto.getVersion()).isEqualTo("1.0.1");
                })
                .verifyComplete();
    }

    @Test
    public void testUpsertModule_UpdateWithHigherVersion() {
        when(repository.findByModuleUuid(testModuleUuid)).thenReturn(Mono.just(testModule));
        when(repository.save(any(UIModule.class))).thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));

        // 업데이트할 DTO (더 높은 버전)
        testDTO.setVersion("2.0.0");

        StepVerifier.create(service.upsertModule(testDTO))
                .assertNext(dto -> {
                    assertThat(dto).isInstanceOf(UIModuleResponseDTO.class);
                    // 요청된 버전이 더 높으면 그대로 사용
                    assertThat(dto.getVersion()).isEqualTo("2.0.0");
                })
                .verifyComplete();
    }

    @Test
    public void testDisableModule_Success() {
        when(repository.findByModuleUuid(testModuleUuid)).thenReturn(Mono.just(testModule));
        when(repository.save(any(UIModule.class))).thenAnswer(invocation -> {
            UIModule module = invocation.getArgument(0);
            assertThat(module.getEnabled()).isFalse();
            return Mono.just(module);
        });

        StepVerifier.create(service.disableModule(testModuleUuid)).verifyComplete();
    }

    @Test
    public void testDisableModule_NotFound() {
        when(repository.findByModuleUuid(anyString())).thenReturn(Mono.empty());

        StepVerifier.create(service.disableModule("non-existent-uuid"))
                .expectError(AppsmithException.class)
                .verify();
    }

    @Test
    public void testGetModuleByUuid_IncludesMeta() {
        when(repository.findByModuleUuidAndEnabledTrue(testModuleUuid)).thenReturn(Mono.just(testModule));

        StepVerifier.create(service.getModuleByUuid(testModuleUuid))
                .assertNext(dto -> {
                    assertThat(dto.getMeta()).isNotNull();
                    assertThat(dto.getMeta().getIcon()).isEqualTo("icon-test");
                    assertThat(dto.getMeta().getColor()).isEqualTo("#FF0000");
                })
                .verifyComplete();
    }
}
