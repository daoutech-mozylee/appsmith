package com.appsmith.server.dtos;

import com.appsmith.external.views.Views;
import com.fasterxml.jackson.annotation.JsonView;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldNameConstants;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@FieldNameConstants
public class ModuleFormSectionDTO {

    @JsonView(Views.Public.class)
    private String id;

    @JsonView(Views.Public.class)
    private String sectionName;

    @JsonView(Views.Public.class)
    private List<ModuleFormFieldDTO> children = new ArrayList<>();
}
