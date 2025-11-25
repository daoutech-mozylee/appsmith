package com.appsmith.server.domains;

import com.appsmith.external.dtos.DslExecutableDTO;
import com.appsmith.external.models.BaseDomain;
import com.appsmith.external.models.CreatorContextType;
import com.appsmith.external.views.Views;
import com.fasterxml.jackson.annotation.JsonView;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldNameConstants;
import net.minidev.json.JSONObject;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@Document("module_instances")
@FieldNameConstants
public class ModuleInstance extends BaseDomain {

    @NotBlank(message = "Source module id is required")
    @JsonView(Views.Public.class)
    private String sourceModuleId;

    @JsonView(Views.Public.class)
    private String moduleId;

    @JsonView(Views.Public.class)
    private String modulePackageId;

    @JsonView(Views.Public.class)
    private String moduleUUID;

    @JsonView(Views.Public.class)
    private String workspaceId;

    @JsonView(Views.Public.class)
    private String applicationId;

    @NotBlank(message = "Context id is required")
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

    @JsonView(Views.Public.class)
    private Map<String, Object> metadata = new HashMap<>();

    @JsonView(Views.Public.class)
    private List<JSONObject> moduleDslSnapshots = new ArrayList<>();

    @JsonView(Views.Public.class)
    private List<List<DslExecutableDTO>> moduleLayoutOnLoadActions = new ArrayList<>();
}
