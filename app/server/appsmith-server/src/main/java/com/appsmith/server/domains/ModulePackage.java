package com.appsmith.server.domains;

import com.appsmith.external.models.BaseDomain;
import com.appsmith.external.views.Views;
import com.appsmith.server.constants.ArtifactType;
import com.appsmith.server.dtos.CustomJSLibContextDTO;
import com.fasterxml.jackson.annotation.JsonView;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import lombok.experimental.FieldNameConstants;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.HashSet;
import java.util.Set;

@Getter
@Setter
@ToString
@NoArgsConstructor
@Document("ui_module_packages")
@FieldNameConstants
public class ModulePackage extends BaseDomain implements Artifact {

    @NotBlank(message = "Name is mandatory")
    @JsonView(Views.Public.class)
    private String name;

    @NotBlank(message = "Workspace id is mandatory")
    @JsonView(Views.Public.class)
    private String workspaceId;

    @JsonView(Views.Public.class)
    private String description;

    @JsonView(Views.Public.class)
    private String icon;

    @JsonView(Views.Public.class)
    private String color;

    @JsonView(Views.Public.class)
    private Boolean exportWithConfiguration = false;

    @JsonView(Views.Public.class)
    private Set<CustomJSLibContextDTO> customJSLibs = new HashSet<>();

    @JsonView(Views.Public.class)
    private GitArtifactMetadata gitArtifactMetadata;

    @JsonView(Views.Public.class)
    private Integer evaluationVersion;

    @Override
    public ArtifactType getArtifactType() {
        return ArtifactType.PACKAGE;
    }

    @Override
    public void makePristine() {
        super.makePristine();
        this.gitArtifactMetadata = null;
    }

    @Override
    public void sanitiseToExportDBObject() {
        super.sanitiseToExportDBObject();
        this.workspaceId = null;
        this.gitArtifactMetadata = null;
    }
}
