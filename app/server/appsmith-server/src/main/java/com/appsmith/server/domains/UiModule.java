package com.appsmith.server.domains;

import com.appsmith.external.models.RefAwareDomain;
import com.appsmith.external.views.Views;
import com.appsmith.server.dtos.ModuleDTO;
import com.fasterxml.jackson.annotation.JsonView;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldNameConstants;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@Document("ui_modules")
@FieldNameConstants
public class UiModule extends RefAwareDomain implements Context {

    @NotBlank(message = "Package id is required")
    @JsonView(Views.Public.class)
    private String packageId;

    @JsonView(Views.Public.class)
    private String workspaceId;

    @JsonView(Views.Public.class)
    private ModuleDTO unpublishedModule;

    @JsonView(Views.Internal.class)
    private ModuleDTO publishedModule;

    @JsonView(Views.Public.class)
    private Integer evaluationVersion;

    @Override
    public void sanitiseToExportDBObject() {
        super.sanitiseToExportDBObject();
        this.workspaceId = null;
        if (this.unpublishedModule != null) {
            this.unpublishedModule.sanitiseToExportDBObject();
        }
        if (this.publishedModule != null) {
            this.publishedModule.sanitiseToExportDBObject();
        }
    }

    @Override
    @JsonView(Views.Internal.class)
    public String getArtifactId() {
        return this.packageId;
    }

    @Override
    @JsonView(Views.Internal.class)
    public Layout getLayout() {
        ModuleDTO moduleDTO = this.unpublishedModule != null ? this.unpublishedModule : this.publishedModule;
        if (moduleDTO == null) {
            return null;
        }
        List<Layout> layouts = moduleDTO.getLayouts();
        return (layouts == null || layouts.isEmpty()) ? null : layouts.get(0);
    }

    @Override
    public String getUnpublishedName() {
        return this.unpublishedModule != null ? this.unpublishedModule.getName() : null;
    }
}
