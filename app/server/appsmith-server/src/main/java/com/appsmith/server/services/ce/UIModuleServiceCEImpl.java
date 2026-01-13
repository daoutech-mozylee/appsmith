package com.appsmith.server.services.ce;

import com.appsmith.server.domains.UIModule;
import com.appsmith.server.dtos.UIModuleDTO;
import com.appsmith.server.dtos.UIModuleListDTO;
import com.appsmith.server.dtos.UIModuleMetaDTO;
import com.appsmith.server.dtos.UIModuleResponseDTO;
import com.appsmith.server.dtos.UIPackageImportDTO;
import com.appsmith.server.exceptions.AppsmithError;
import com.appsmith.server.exceptions.AppsmithException;
import com.appsmith.server.repositories.UIModuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

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
        module.setDefinition(mergeActionsIntoDefinition(dto));
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
        existing.setDefinition(mergeActionsIntoDefinition(dto));
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
     * actionList와 actionCollectionList를 definition에 병합
     *
     * 패키지 JSON 구조에서 actionList와 actionCollectionList는 루트 레벨에 있지만,
     * 클라이언트에서는 definition 내부에서 찾기를 기대합니다.
     * 이 메서드는 DTO의 별도 필드로 전달된 actions를 definition에 병합합니다.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> mergeActionsIntoDefinition(UIModuleDTO dto) {
        Map<String, Object> definition = dto.getDefinition();
        if (definition == null) {
            definition = new HashMap<>();
        } else {
            // 원본을 수정하지 않도록 복사
            definition = new HashMap<>(definition);
        }

        // actionList 병합 (dto에서 전달된 경우)
        List<Map<String, Object>> actionList = dto.getActionList();
        if (actionList != null && !actionList.isEmpty()) {
            // 해당 모듈에 속하는 액션만 필터링 (moduleId 또는 unpublishedAction.moduleId로 확인)
            String moduleName = dto.getModuleName();
            List<Map<String, Object>> filteredActions = filterActionsByModule(actionList, moduleName);

            // 기존 definition의 actionList와 병합
            Object existingActionList = definition.get("actionList");
            if (existingActionList instanceof List) {
                List<Map<String, Object>> merged = new ArrayList<>((List<Map<String, Object>>) existingActionList);
                merged.addAll(filteredActions);
                definition.put("actionList", merged);
            } else {
                definition.put("actionList", filteredActions);
            }

            log.info("Merged {} actions into definition for module {}", filteredActions.size(), moduleName);
        }

        // actionCollectionList 병합 (dto에서 전달된 경우)
        List<Map<String, Object>> actionCollectionList = dto.getActionCollectionList();
        if (actionCollectionList != null && !actionCollectionList.isEmpty()) {
            String moduleName = dto.getModuleName();
            List<Map<String, Object>> filteredCollections =
                    filterActionCollectionsByModule(actionCollectionList, moduleName);

            // 기존 definition의 actionCollectionList와 병합
            Object existingCollectionList = definition.get("actionCollectionList");
            if (existingCollectionList instanceof List) {
                List<Map<String, Object>> merged = new ArrayList<>((List<Map<String, Object>>) existingCollectionList);
                merged.addAll(filteredCollections);
                definition.put("actionCollectionList", merged);
            } else {
                definition.put("actionCollectionList", filteredCollections);
            }

            log.info(
                    "Merged {} action collections into definition for module {}",
                    filteredCollections.size(),
                    moduleName);
        }

        return definition;
    }

    /**
     * 특정 모듈에 속하는 액션만 필터링
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> filterActionsByModule(List<Map<String, Object>> actionList, String moduleName) {
        List<Map<String, Object>> filtered = new ArrayList<>();
        for (Map<String, Object> action : actionList) {
            String actionModuleId = getModuleIdFromAction(action);
            if (moduleName.equals(actionModuleId)) {
                filtered.add(action);
            }
        }
        return filtered;
    }

    /**
     * 특정 모듈에 속하는 액션 컬렉션만 필터링
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> filterActionCollectionsByModule(
            List<Map<String, Object>> collectionList, String moduleName) {
        List<Map<String, Object>> filtered = new ArrayList<>();
        for (Map<String, Object> collection : collectionList) {
            String collectionModuleId = getModuleIdFromActionCollection(collection);
            if (moduleName.equals(collectionModuleId)) {
                filtered.add(collection);
            }
        }
        return filtered;
    }

    /**
     * 액션에서 moduleId 추출
     * unpublishedAction.moduleId 또는 직접 moduleId 필드 확인
     */
    @SuppressWarnings("unchecked")
    private String getModuleIdFromAction(Map<String, Object> action) {
        // unpublishedAction.moduleId 확인
        Object unpublishedAction = action.get("unpublishedAction");
        if (unpublishedAction instanceof Map) {
            Object moduleId = ((Map<String, Object>) unpublishedAction).get("moduleId");
            if (moduleId != null) {
                return moduleId.toString();
            }
        }
        // 직접 moduleId 필드 확인
        Object moduleId = action.get("moduleId");
        return moduleId != null ? moduleId.toString() : null;
    }

    /**
     * 액션 컬렉션에서 moduleId 추출
     * unpublishedCollection.moduleId 또는 직접 moduleId 필드 확인
     */
    @SuppressWarnings("unchecked")
    private String getModuleIdFromActionCollection(Map<String, Object> collection) {
        // unpublishedCollection.moduleId 확인
        Object unpublishedCollection = collection.get("unpublishedCollection");
        if (unpublishedCollection instanceof Map) {
            Object moduleId = ((Map<String, Object>) unpublishedCollection).get("moduleId");
            if (moduleId != null) {
                return moduleId.toString();
            }
        }
        // 직접 moduleId 필드 확인
        Object moduleId = collection.get("moduleId");
        return moduleId != null ? moduleId.toString() : null;
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

    /**
     * 패키지 JSON 일괄 Import
     *
     * 패키지 JSON 파일의 전체 구조를 받아서 모듈들을 일괄 등록합니다.
     * actionList와 actionCollectionList는 각 모듈의 definition에 자동으로 병합됩니다.
     */
    @Override
    public Mono<List<UIModuleResponseDTO>> importPackage(UIPackageImportDTO packageDto) {
        if (packageDto.getModuleList() == null || packageDto.getModuleList().isEmpty()) {
            return Mono.just(new ArrayList<>());
        }

        String packageUuid = packageDto.getExportedPackage() != null
                ? packageDto.getExportedPackage().getPackageUUID()
                : null;
        String packageName = packageDto.getExportedPackage() != null
                        && packageDto.getExportedPackage().getUnpublishedPackage() != null
                ? packageDto.getExportedPackage().getUnpublishedPackage().getName()
                : null;

        log.info(
                "Importing package: packageUuid={}, packageName={}, moduleCount={}",
                packageUuid,
                packageName,
                packageDto.getModuleList().size());

        // 각 모듈을 UIModuleDTO로 변환하여 upsert
        List<Mono<UIModuleResponseDTO>> moduleMonos = new ArrayList<>();

        for (UIPackageImportDTO.ModuleItem moduleItem : packageDto.getModuleList()) {
            UIModuleDTO moduleDto = convertModuleItemToDTO(
                    moduleItem,
                    packageUuid,
                    packageName,
                    packageDto.getActionList(),
                    packageDto.getActionCollectionList());

            moduleMonos.add(upsertModule(moduleDto));
        }

        return Flux.merge(moduleMonos).collectList();
    }

    /**
     * ModuleItem을 UIModuleDTO로 변환
     */
    private UIModuleDTO convertModuleItemToDTO(
            UIPackageImportDTO.ModuleItem moduleItem,
            String packageUuid,
            String packageName,
            List<Map<String, Object>> actionList,
            List<Map<String, Object>> actionCollectionList) {

        UIModuleDTO dto = new UIModuleDTO();
        dto.setModuleUUID(moduleItem.getModuleUUID());
        dto.setPackageUUID(packageUuid);
        dto.setModuleName(
                moduleItem.getUnpublishedModule() != null
                        ? moduleItem.getUnpublishedModule().getName()
                        : null);
        dto.setPackageName(packageName);

        // definition 구성
        Map<String, Object> definition = new HashMap<>();
        if (moduleItem.getUnpublishedModule() != null) {
            UIPackageImportDTO.UnpublishedModule unpub = moduleItem.getUnpublishedModule();
            if (unpub.getLayouts() != null) {
                definition.put("layouts", unpub.getLayouts());
            }
            if (unpub.getInputsForm() != null) {
                definition.put("inputsForm", unpub.getInputsForm());
            }
            if (unpub.getOutputsForm() != null) {
                definition.put("outputsForm", unpub.getOutputsForm());
            }
        }
        dto.setDefinition(definition);

        // actionList와 actionCollectionList를 전달 (서비스에서 필터링 및 병합)
        dto.setActionList(actionList);
        dto.setActionCollectionList(actionCollectionList);

        log.info(
                "Converting module: moduleUuid={}, moduleName={}, actionListSize={}, actionCollectionListSize={}",
                dto.getModuleUUID(),
                dto.getModuleName(),
                actionList != null ? actionList.size() : 0,
                actionCollectionList != null ? actionCollectionList.size() : 0);

        return dto;
    }
}
