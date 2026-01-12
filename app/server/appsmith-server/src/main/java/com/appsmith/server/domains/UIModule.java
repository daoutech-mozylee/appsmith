package com.appsmith.server.domains;

import com.appsmith.external.models.BaseDomain;
import com.appsmith.external.views.Views;
import com.fasterxml.jackson.annotation.JsonView;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.experimental.FieldNameConstants;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;
import java.util.Map;

/**
 * UIModule 엔티티
 *
 * 모듈 시스템에서 관리하는 UI 모듈 정의를 저장합니다.
 * MongoDB의 uiModules 컬렉션에 저장됩니다.
 */
@Data
@EqualsAndHashCode(callSuper = true)
@ToString(callSuper = true)
@NoArgsConstructor
@Document(collection = "uiModules")
@FieldNameConstants
public class UIModule extends BaseDomain {

    /**
     * 모듈 고유 식별자 (UUID 형식)
     * unique 인덱스가 적용됩니다.
     */
    @Indexed(unique = true)
    @JsonView(Views.Public.class)
    private String moduleUuid;

    /**
     * 패키지 고유 식별자 (UUID 형식)
     */
    @Indexed
    @JsonView(Views.Public.class)
    private String packageUuid;

    /**
     * 모듈 이름 (예: "OrgChartChip")
     */
    @JsonView(Views.Public.class)
    private String moduleName;

    /**
     * 패키지 이름 (예: "DaouComponents")
     */
    @JsonView(Views.Public.class)
    private String packageName;

    /**
     * 시맨틱 버전 (예: "1.0.0")
     */
    @JsonView(Views.Public.class)
    private String version = "1.0.0";

    /**
     * 전체 모듈 정의 (JSON)
     * layouts, inputsForm, outputsForm, actionList, actionCollectionList 포함
     */
    @JsonView(Views.Public.class)
    private Map<String, Object> definition;

    /**
     * 모듈 메타데이터
     */
    @JsonView(Views.Public.class)
    private UIModuleMeta meta;

    /**
     * 활성화 여부 (soft delete용)
     */
    @JsonView(Views.Public.class)
    private Boolean enabled = true;

    /**
     * 모듈 메타데이터 내부 클래스
     */
    @Data
    @NoArgsConstructor
    public static class UIModuleMeta {
        /**
         * 아이콘 이름
         */
        @JsonView(Views.Public.class)
        private String icon;

        /**
         * 대표 색상 (hex 형식)
         */
        @JsonView(Views.Public.class)
        private String color;

        /**
         * 모듈 설명
         */
        @JsonView(Views.Public.class)
        private String description;

        /**
         * 태그 목록
         */
        @JsonView(Views.Public.class)
        private List<String> tags;
    }

    public static class Fields extends BaseDomain.Fields {}
}
