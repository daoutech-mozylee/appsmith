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
 * Migration to update Daouoffice plugin type to REMOTE
 * 기존 SAAS 타입으로 등록된 Daouoffice 플러그인을 REMOTE 타입으로 변경
 */
@Slf4j
@ChangeUnit(order = "079", id = "update-daouoffice-plugin-to-remote", author = " ")
public class Migration079UpdateDaouofficeToRemote {
    private final MongoTemplate mongoTemplate;

    public Migration079UpdateDaouofficeToRemote(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @RollbackExecution
    public void rollbackExecution() {
        log.info("Rolling back Daouoffice plugin to SAAS");
    }

    @Execution
    public void updateDaouofficePluginToRemote() {
        try {
            Query query = new Query(Criteria.where("packageName").is("daouoffice-plugin"));

            Plugin existingPlugin = mongoTemplate.findOne(query, Plugin.class);

            if (existingPlugin == null) {
                log.warn("⚠️ Daouoffice plugin not found in database. Skipping update.");
                return;
            }

            log.info("📦 Finding Daouoffice plugin : {}", existingPlugin.getType());

            Update update = new Update();
            update.set("type", PluginType.REMOTE);
            // REMOTE 타입에 맞는 UI 설정이 필요하다면 추가해야 할 수도 있음
            // update.set("uiComponent", "UidCompoment");

            mongoTemplate.updateFirst(query, update, Plugin.class);

            log.info("✅ Daouoffice plugin successfully updated to REMOTE type");

        } catch (Exception e) {
            log.error("❌ Failed to update Daouoffice plugin to REMOTE", e);
            throw e;
        }
    }
}
