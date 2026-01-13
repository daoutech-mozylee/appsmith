package com.appsmith.server.dtos;

import com.appsmith.external.views.Views;
import com.fasterxml.jackson.annotation.JsonView;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * UIModule 요청 DTO
 *
 * 모듈 생성/수정 요청에 사용됩니다.
 */
@Data
@NoArgsConstructor
public class UIModuleDTO {

    /**
     * 모듈 고유 식별자 (UUID 형식)
     */
    @NotBlank(message = "moduleUUID is required")
    @JsonView(Views.Public.class)
    private String moduleUUID;

    /**
     * 패키지 고유 식별자 (UUID 형식)
     */
    @NotBlank(message = "packageUUID is required")
    @JsonView(Views.Public.class)
    private String packageUUID;

    /**
     * 모듈 이름 (예: "OrgChartChip")
     */
    @NotBlank(message = "moduleName is required")
    @JsonView(Views.Public.class)
    private String moduleName;

    /**
     * 패키지 이름 (예: "DaouComponents")
     */
    @NotBlank(message = "packageName is required")
    @JsonView(Views.Public.class)
    private String packageName;

    /**
     * 시맨틱 버전 (예: "1.0.0")
     */
    @JsonView(Views.Public.class)
    private String version = "1.0.0";

    /**
     * 전체 모듈 정의 (JSON)
     */
    @NotNull(message = "definition is required") @JsonView(Views.Public.class)
    private Map<String, Object> definition;

    /**
     * 모듈 메타데이터
     */
    @JsonView(Views.Public.class)
    private UIModuleMetaDTO meta;

    /**
     * 액션 목록 (패키지 루트 레벨에서 전달될 수 있음)
     * 서비스에서 definition에 병합됨
     */
    @JsonView(Views.Public.class)
    private List<Map<String, Object>> actionList;

    /**
     * 액션 컬렉션 목록 (패키지 루트 레벨에서 전달될 수 있음)
     * 서비스에서 definition에 병합됨
     */
    @JsonView(Views.Public.class)
    private List<Map<String, Object>> actionCollectionList;
}
