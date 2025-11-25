package com.appsmith.server.dtos;

import com.appsmith.external.views.Views;
import com.appsmith.server.domains.Layout;
import com.appsmith.server.domains.ce.LayoutContainer;
import com.fasterxml.jackson.annotation.JsonView;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldNameConstants;
import org.springframework.data.annotation.Transient;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@FieldNameConstants
public class ModuleDTO implements LayoutContainer {

    @Transient
    @JsonView(Views.Public.class)
    private String id;

    @JsonView(Views.Public.class)
    private String packageId;

    @JsonView(Views.Public.class)
    private String name;

    @JsonView(Views.Public.class)
    private String icon;

    @JsonView(Views.Public.class)
    private String color;

    @JsonView(Views.Public.class)
    private String description;

    @JsonView(Views.Public.class)
    private String moduleUUID;

    @JsonView(Views.Public.class)
    private List<Layout> layouts = new ArrayList<>();

    @JsonView(Views.Public.class)
    private List<ModuleFormSectionDTO> inputsForm = new ArrayList<>();

    @JsonView(Views.Public.class)
    private List<ModuleFormSectionDTO> outputsForm = new ArrayList<>();

    @JsonView(Views.Public.class)
    private List<String> layoutOnLoadActions = new ArrayList<>();

    @JsonView(Views.Public.class)
    private List<String> layoutOnLoadActionErrors = new ArrayList<>();

    @JsonView(Views.Public.class)
    private Map<String, List<String>> dependencyMap = new HashMap<>();

    public void sanitiseToExportDBObject() {
        if (layouts != null) {
            layouts.forEach(Layout::sanitiseToExportDBObject);
        }
    }
}
