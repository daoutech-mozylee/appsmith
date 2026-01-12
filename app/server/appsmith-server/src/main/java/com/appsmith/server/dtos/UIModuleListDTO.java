package com.appsmith.server.dtos;

import com.appsmith.external.views.Views;
import com.fasterxml.jackson.annotation.JsonView;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * UIModule 목록 조회용 간략 DTO
 *
 * 모듈 목록 조회 시 definition을 제외하고 반환합니다.
 */
@Data
@NoArgsConstructor
public class UIModuleListDTO {

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
     * 모듈 메타데이터
     */
    @JsonView(Views.Public.class)
    private UIModuleMetaDTO meta;
}
