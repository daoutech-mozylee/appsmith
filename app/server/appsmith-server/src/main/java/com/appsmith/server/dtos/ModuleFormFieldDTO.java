package com.appsmith.server.dtos;

import com.appsmith.external.views.Views;
import com.fasterxml.jackson.annotation.JsonView;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldNameConstants;

import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@FieldNameConstants
public class ModuleFormFieldDTO {

    @JsonView(Views.Public.class)
    private String id;

    @JsonView(Views.Public.class)
    private String label;

    @JsonView(Views.Public.class)
    private String propertyName;

    @JsonView(Views.Public.class)
    private String controlType;

    @JsonView(Views.Public.class)
    private String dataType;

    @JsonView(Views.Public.class)
    private Boolean required;

    @JsonView(Views.Public.class)
    private Object defaultValue;

    @JsonView(Views.Public.class)
    private Map<String, Object> configuration;
}
