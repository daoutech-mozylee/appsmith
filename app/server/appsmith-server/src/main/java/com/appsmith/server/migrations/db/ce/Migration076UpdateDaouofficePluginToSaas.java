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
 * Migration to update Daouoffice plugin type from API to SAAS
 * 기존 API 타입으로 등록된 Daouoffice 플러그인을 SAAS 타입으로 변경
 */
@Slf4j
@ChangeUnit(order = "076", id = "update-daouoffice-plugin-to-saas", author = " ")
public class Migration076UpdateDaouofficePluginToSaas {
    private final MongoTemplate mongoTemplate;

    public Migration076UpdateDaouofficePluginToSaas(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @RollbackExecution
    public void rollbackExecution() {
        log.info("Rolling back Daouoffice plugin update");
    }

    @Execution
    public void updateDaouofficePluginToSaas() {
        try {
            // packageName으로 Daouoffice 플러그인 찾기
            Query query = new Query(Criteria.where("packageName").is("daouoffice-plugin"));

            Plugin existingPlugin = mongoTemplate.findOne(query, Plugin.class);

            if (existingPlugin == null) {
                log.warn("⚠️ Daouoffice plugin not found in database. Skipping update.");
                return;
            }

            log.info("📦 Found Daouoffice plugin with current type: {}", existingPlugin.getType());

            // SAAS 타입으로 업데이트
            Update update = new Update();
            update.set("type", PluginType.SAAS);  // API → SAAS
            update.set("uiComponent", "UQIDbEditorForm");  // SAAS 플러그인 표준 에디터

            mongoTemplate.updateFirst(query, update, Plugin.class);

            log.info("✅ Daouoffice plugin successfully updated to SAAS type");
            log.info("   - Type: API → SAAS");
            log.info("   - UiComponent: ApiEditorForm → UQIDbEditorForm");
            log.info("   - Now will appear in 'Saas Integrations' section");

        } catch (Exception e) {
            log.error("❌ Failed to update Daouoffice plugin", e);
            throw e;
        }
    }
}

