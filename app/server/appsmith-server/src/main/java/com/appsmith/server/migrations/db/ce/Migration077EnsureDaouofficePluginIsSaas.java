package com.appsmith.server.migrations.db.ce;

import com.appsmith.external.models.PluginType;
import com.appsmith.server.domains.Plugin;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

/**
 * Daouoffice 플러그인을 SAAS 타입으로 강제 설정하는 마이그레이션
 */
@Slf4j
@ChangeUnit(order = "077", id = "ensure-daouoffice-plugin-is-saas", author = " ")
public class Migration077EnsureDaouofficePluginIsSaas {

    private final MongoTemplate mongoTemplate;

    public Migration077EnsureDaouofficePluginIsSaas(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @RollbackExecution
    public void rollbackExecution() {
        log.info("Rolling back Daouoffice plugin SAAS enforcement");
    }

    @Execution
    public void ensureDaouofficePluginIsSaas() {
        try {
            Query query = new Query(Criteria.where("packageName").is("daouoffice-plugin"));
            Plugin existingPlugin = mongoTemplate.findOne(query, Plugin.class);

            if (existingPlugin == null) {
                log.warn("⚠️ Daouoffice plugin not found in database. Skipping SAAS enforcement.");
                return;
            }

            log.info("📦 Ensuring Daouoffice plugin is SAAS, current type: {}", existingPlugin.getType());

            Update update = new Update();
            update.set("type", PluginType.SAAS);
            update.set("uiComponent", "UQIDbEditorForm");
            update.set("datasourceComponent", "AutoForm");

            mongoTemplate.updateFirst(query, update, Plugin.class);

            log.info("✅ Daouoffice plugin is now marked as SAAS");
        } catch (Exception e) {
            log.error("❌ Failed to enforce SAAS type for Daouoffice plugin", e);
            throw e;
        }
    }
}
