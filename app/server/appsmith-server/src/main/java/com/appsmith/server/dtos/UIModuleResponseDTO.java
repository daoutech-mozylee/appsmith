package com.appsmith.server.dtos;

import com.appsmith.external.views.Views;
import com.fasterxml.jackson.annotation.JsonView;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

/**
 * UIModule 상세 응답 DTO
 *
 * 모듈 상세 조회 시 definition을 포함하여 반환합니다.
 */
@Data
@NoArgsConstructor
public class UIModuleResponseDTO {

    /**
     * 내부 ID
     */
    @JsonView(Views.Public.class)
    private String id;

    /**
     * 모듈 고유 식별자 (UUID 형식)
     */
    @JsonView(Views.Public.class)
    private String moduleUUID;

    /**
     * 패키지 고유 식별자 (UUID 형식)
     */
    @JsonView(Views.Public.class)
    private String packageUUID;

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
    private String version;

    /**
     * 전체 모듈 정의 (JSON)
     */
    @JsonView(Views.Public.class)
    private Map<String, Object> definition;

    /**
     * 모듈 메타데이터
     */
    @JsonView(Views.Public.class)
    private UIModuleMetaDTO meta;

    /**
     * 생성 일시
     */
    @JsonView(Views.Public.class)
    private Instant createdAt;

    /**
     * 수정 일시
     */
    @JsonView(Views.Public.class)
    private Instant updatedAt;
}
