package com.appsmith.server.dtos;

import com.appsmith.external.views.Views;
import com.fasterxml.jackson.annotation.JsonView;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * UIModule 메타데이터 DTO
 */
@Data
@NoArgsConstructor
public class UIModuleMetaDTO {

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
