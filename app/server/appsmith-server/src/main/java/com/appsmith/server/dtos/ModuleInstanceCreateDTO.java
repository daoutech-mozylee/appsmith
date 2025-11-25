package com.appsmith.server.dtos;

import com.appsmith.external.models.CreatorContextType;
import com.appsmith.external.views.Views;
import com.fasterxml.jackson.annotation.JsonView;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.HashMap;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
public class ModuleInstanceCreateDTO {

    @JsonView(Views.Public.class)
    private String sourceModuleId;

    @JsonView(Views.Public.class)
    private String contextId;

    @JsonView(Views.Public.class)
    private CreatorContextType contextType = CreatorContextType.PAGE;

    @JsonView(Views.Public.class)
    private String name;

    @JsonView(Views.Public.class)
    private String widgetId;

    @JsonView(Views.Public.class)
    private Map<String, Object> inputBindings = new HashMap<>();

    @JsonView(Views.Public.class)
    private Map<String, Object> outputBindings = new HashMap<>();
}
