package com.appsmith.server.dtos;

import com.appsmith.external.views.Views;
import com.appsmith.server.domains.ModuleInstance;
import com.appsmith.server.domains.ModulePackage;
import com.appsmith.server.domains.UiModule;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonView;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.Collections;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ModulePackageResponseDTO {

    @JsonView(Views.Public.class)
    private ModulePackage packageData;

    @JsonView(Views.Public.class)
    private List<UiModule> modules = Collections.emptyList();

    @JsonView(Views.Public.class)
    private List<ModuleInstance> moduleInstances = Collections.emptyList();

    @JsonView(Views.Public.class)
    private List<Object> modulesMetadata = Collections.emptyList();
}
