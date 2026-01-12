package com.appsmith.server.services.ce;

import com.appsmith.server.domains.UIModule;
import com.appsmith.server.dtos.UIModuleDTO;
import com.appsmith.server.dtos.UIModuleListDTO;
import com.appsmith.server.dtos.UIModuleMetaDTO;
import com.appsmith.server.dtos.UIModuleResponseDTO;
import com.appsmith.server.exceptions.AppsmithError;
import com.appsmith.server.exceptions.AppsmithException;
import com.appsmith.server.repositories.UIModuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * UIModule CE 서비스 구현체
 */
@Slf4j
@RequiredArgsConstructor
public class UIModuleServiceCEImpl implements UIModuleServiceCE {

    private final UIModuleRepository repository;

    @Override
    public Flux<UIModuleListDTO> getAllModules() {
        return repository.findAllByEnabledTrue().map(this::toListDTO);
    }

    @Override
    public Mono<UIModuleResponseDTO> getModuleByUuid(String moduleUuid) {
        return repository
                .findByModuleUuidAndEnabledTrue(moduleUuid)
                .switchIfEmpty(
                        Mono.error(new AppsmithException(AppsmithError.NO_RESOURCE_FOUND, "UIModule", moduleUuid)))
                .map(this::toResponseDTO);
    }

    @Override
    public Mono<UIModuleResponseDTO> upsertModule(UIModuleDTO dto) {
        return repository
                .findByModuleUuid(dto.getModuleUUID())
                .flatMap(existing -> updateExistingModule(existing, dto))
                .switchIfEmpty(Mono.defer(() -> createNewModule(dto)))
                .map(this::toResponseDTO);
    }

    @Override
    public Mono<Void> disableModule(String moduleUuid) {
        return repository
                .findByModuleUuid(moduleUuid)
                .switchIfEmpty(
                        Mono.error(new AppsmithException(AppsmithError.NO_RESOURCE_FOUND, "UIModule", moduleUuid)))
                .flatMap(module -> {
                    module.setEnabled(false);
                    return repository.save(module);
                })
                .then();
    }

    /**
     * 새 모듈 생성
     */
    private Mono<UIModule> createNewModule(UIModuleDTO dto) {
        UIModule module = new UIModule();
        module.setModuleUuid(dto.getModuleUUID());
        module.setPackageUuid(dto.getPackageUUID());
        module.setModuleName(dto.getModuleName());
        module.setPackageName(dto.getPackageName());
        module.setVersion(dto.getVersion() != null ? dto.getVersion() : "1.0.0");
        module.setDefinition(dto.getDefinition());
        module.setMeta(toModuleMeta(dto.getMeta()));
        module.setEnabled(true);

        log.info("Creating new UIModule: moduleUuid={}, moduleName={}", dto.getModuleUUID(), dto.getModuleName());

        return repository.save(module);
    }

    /**
     * 기존 모듈 업데이트
     */
    private Mono<UIModule> updateExistingModule(UIModule existing, UIModuleDTO dto) {
        // 버전 자동 증가
        String newVersion = incrementVersion(existing.getVersion(), dto.getVersion());

        existing.setPackageUuid(dto.getPackageUUID());
        existing.setModuleName(dto.getModuleName());
        existing.setPackageName(dto.getPackageName());
        existing.setVersion(newVersion);
        existing.setDefinition(dto.getDefinition());
        existing.setMeta(toModuleMeta(dto.getMeta()));
        existing.setEnabled(true); // 비활성화된 모듈도 업데이트 시 활성화

        log.info(
                "Updating UIModule: moduleUuid={}, moduleName={}, version={}",
                dto.getModuleUUID(),
                dto.getModuleName(),
                newVersion);

        return repository.save(existing);
    }

    /**
     * 버전 증가 로직
     *
     * 요청된 버전이 기존 버전과 같거나 작으면 patch 버전을 1 증가시킵니다.
     * 예: 1.0.0 -> 1.0.1, 1.2.3 -> 1.2.4
     */
    private String incrementVersion(String existingVersion, String requestedVersion) {
        if (requestedVersion != null && compareVersions(requestedVersion, existingVersion) > 0) {
            // 요청된 버전이 기존보다 크면 요청된 버전 사용
            return requestedVersion;
        }

        // 기존 버전의 patch 증가
        try {
            String[] parts = existingVersion.split("\\.");
            if (parts.length >= 3) {
                int patch = Integer.parseInt(parts[2]) + 1;
                return parts[0] + "." + parts[1] + "." + patch;
            }
        } catch (NumberFormatException e) {
            log.warn("Failed to parse version: {}", existingVersion);
        }

        // 파싱 실패 시 기존 버전 유지
        return existingVersion;
    }

    /**
     * 시맨틱 버전 비교
     *
     * @return 양수: v1 > v2, 0: v1 == v2, 음수: v1 < v2
     */
    private int compareVersions(String v1, String v2) {
        String[] parts1 = v1.split("\\.");
        String[] parts2 = v2.split("\\.");

        for (int i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            int num1 = i < parts1.length ? parseVersionPart(parts1[i]) : 0;
            int num2 = i < parts2.length ? parseVersionPart(parts2[i]) : 0;

            if (num1 != num2) {
                return num1 - num2;
            }
        }
        return 0;
    }

    private int parseVersionPart(String part) {
        try {
            return Integer.parseInt(part);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /**
     * Entity -> ListDTO 변환
     */
    private UIModuleListDTO toListDTO(UIModule module) {
        UIModuleListDTO dto = new UIModuleListDTO();
        dto.setModuleUUID(module.getModuleUuid());
        dto.setPackageUUID(module.getPackageUuid());
        dto.setModuleName(module.getModuleName());
        dto.setPackageName(module.getPackageName());
        dto.setVersion(module.getVersion());
        dto.setMeta(toMetaDTO(module.getMeta()));
        return dto;
    }

    /**
     * Entity -> ResponseDTO 변환
     */
    private UIModuleResponseDTO toResponseDTO(UIModule module) {
        UIModuleResponseDTO dto = new UIModuleResponseDTO();
        dto.setId(module.getId());
        dto.setModuleUUID(module.getModuleUuid());
        dto.setPackageUUID(module.getPackageUuid());
        dto.setModuleName(module.getModuleName());
        dto.setPackageName(module.getPackageName());
        dto.setVersion(module.getVersion());
        dto.setDefinition(module.getDefinition());
        dto.setMeta(toMetaDTO(module.getMeta()));
        dto.setCreatedAt(module.getCreatedAt());
        dto.setUpdatedAt(module.getUpdatedAt());
        return dto;
    }

    /**
     * MetaDTO -> ModuleMeta 변환
     */
    private UIModule.UIModuleMeta toModuleMeta(UIModuleMetaDTO metaDTO) {
        if (metaDTO == null) {
            return null;
        }
        UIModule.UIModuleMeta meta = new UIModule.UIModuleMeta();
        meta.setIcon(metaDTO.getIcon());
        meta.setColor(metaDTO.getColor());
        meta.setDescription(metaDTO.getDescription());
        meta.setTags(metaDTO.getTags());
        return meta;
    }

    /**
     * ModuleMeta -> MetaDTO 변환
     */
    private UIModuleMetaDTO toMetaDTO(UIModule.UIModuleMeta meta) {
        if (meta == null) {
            return null;
        }
        UIModuleMetaDTO dto = new UIModuleMetaDTO();
        dto.setIcon(meta.getIcon());
        dto.setColor(meta.getColor());
        dto.setDescription(meta.getDescription());
        dto.setTags(meta.getTags());
        return dto;
    }
}
