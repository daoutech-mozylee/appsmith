package com.appsmith.server.migrations.db.ce;

import com.appsmith.server.domains.Workspace;
import com.appsmith.server.domains.WorkspacePlugin;
import com.appsmith.server.dtos.WorkspacePluginStatus;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

/**
 * 모든 워크스페이스에 Daouoffice 플러그인이 설치되어 있는지 보장
 */
@Slf4j
@ChangeUnit(
        order = "078",
        id = "install-daouoffice-plugin-in-workspaces",
        author = " ")
public class Migration078InstallDaouofficePluginInWorkspaces {

    private final MongoTemplate mongoTemplate;

    public Migration078InstallDaouofficePluginInWorkspaces(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @RollbackExecution
    public void rollbackExecution() {
        log.info("Rolling back Daouoffice workspace installation enforcement");
    }

    @Execution
    public void installDaouofficePluginInWorkspaces() {
        try {
            Query pluginQuery = new Query(Criteria.where("packageName").is("daouoffice-plugin"));
            var plugin = mongoTemplate.findOne(pluginQuery, com.appsmith.server.domains.Plugin.class);

            if (plugin == null || plugin.getId() == null) {
                log.warn("⚠️ Daouoffice plugin not found, skipping workspace installation.");
                return;
            }

            WorkspacePlugin workspacePlugin = new WorkspacePlugin(plugin.getId(), WorkspacePluginStatus.ACTIVATED);

            Update update = new Update().addToSet("plugins", workspacePlugin);

            mongoTemplate.updateMulti(new Query(), update, Workspace.class);

            log.info("✅ Ensured Daouoffice plugin is installed in all workspaces");
        } catch (Exception e) {
            log.error("❌ Failed to install Daouoffice plugin in workspaces", e);
            throw e;
        }
    }
}
