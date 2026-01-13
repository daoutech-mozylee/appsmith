package com.appsmith.server.dtos;

import com.appsmith.external.views.Views;
import com.fasterxml.jackson.annotation.JsonView;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * 패키지 전체 Import를 위한 DTO
 *
 * 패키지 JSON 파일의 전체 구조를 받아서 모듈들을 일괄 등록합니다.
 * actionList와 actionCollectionList는 각 모듈의 definition에 자동으로 병합됩니다.
 *
 * 패키지 JSON 구조:
 * {
 *   "exportedPackage": { "packageUUID": "...", "type": "UI", ... },
 *   "moduleList": [{ ... }],
 *   "actionList": [{ "unpublishedAction": { "moduleId": "ModuleName", ... } }],
 *   "actionCollectionList": [{ "unpublishedCollection": { "moduleId": "ModuleName", ... } }]
 * }
 */
@Data
@NoArgsConstructor
public class UIPackageImportDTO {

    /**
     * 패키지 정보
     */
    @JsonView(Views.Public.class)
    private ExportedPackage exportedPackage;

    /**
     * 모듈 목록
     */
    @JsonView(Views.Public.class)
    private List<ModuleItem> moduleList;

    /**
     * 액션 목록 (패키지 레벨)
     */
    @JsonView(Views.Public.class)
    private List<Map<String, Object>> actionList;

    /**
     * 액션 컬렉션 목록 (패키지 레벨)
     */
    @JsonView(Views.Public.class)
    private List<Map<String, Object>> actionCollectionList;

    @Data
    @NoArgsConstructor
    public static class ExportedPackage {
        @JsonView(Views.Public.class)
        private String packageUUID;

        @JsonView(Views.Public.class)
        private String type;

        @JsonView(Views.Public.class)
        private UnpublishedPackage unpublishedPackage;
    }

    @Data
    @NoArgsConstructor
    public static class UnpublishedPackage {
        @JsonView(Views.Public.class)
        private String name;

        @JsonView(Views.Public.class)
        private String icon;

        @JsonView(Views.Public.class)
        private String color;
    }

    @Data
    @NoArgsConstructor
    public static class ModuleItem {
        @JsonView(Views.Public.class)
        private String type;

        @JsonView(Views.Public.class)
        private String moduleUUID;

        @JsonView(Views.Public.class)
        private UnpublishedModule unpublishedModule;
    }

    @Data
    @NoArgsConstructor
    public static class UnpublishedModule {
        @JsonView(Views.Public.class)
        private String name;

        @JsonView(Views.Public.class)
        private List<Map<String, Object>> inputsForm;

        @JsonView(Views.Public.class)
        private List<Map<String, Object>> outputsForm;

        @JsonView(Views.Public.class)
        private List<Map<String, Object>> layouts;
    }
}
