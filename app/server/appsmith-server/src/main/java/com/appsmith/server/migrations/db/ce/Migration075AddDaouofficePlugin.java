package com.appsmith.server.migrations.db.ce;

import com.appsmith.external.models.PluginType;
import com.appsmith.server.domains.Plugin;
import io.mongock.api.annotations.ChangeUnit;
import io.mongock.api.annotations.Execution;
import io.mongock.api.annotations.RollbackExecution;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;

import static com.appsmith.server.migrations.DatabaseChangelog1.installPluginToAllWorkspaces;

/**
 * Migration to add Daouoffice plugin to MongoDB
 * Saas Integrations 섹션에 표시되는 조직도 연동 플러그인
 */
@Slf4j
@ChangeUnit(order = "075", id = "add-daouoffice-plugin", author = " ")
public class Migration075AddDaouofficePlugin {
    private final MongoTemplate mongoTemplate;

    public Migration075AddDaouofficePlugin(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @RollbackExecution
    public void rollbackExecution() {
        // Rollback 시 플러그인 삭제
        log.info("Rolling back Daouoffice plugin installation");
    }

    @Execution
    public void addDaouofficePlugin() {
        Plugin plugin = new Plugin();

        // 기본 정보
        plugin.setName("Daouoffice");
        plugin.setType(PluginType.SAAS);  // SAAS 타입 (Saas Integrations 섹션에 표시)
        plugin.setPackageName("daouoffice-plugin");  // plugin.properties의 plugin.id와 일치
        plugin.setPluginName("daouoffice-plugin");

        // UI 컴포넌트 설정 (SAAS 플러그인용)
        plugin.setUiComponent("UQIDbEditorForm");  // SAAS 플러그인 표준 에디터
        plugin.setDatasourceComponent("AutoForm");  // form.json 자동 사용

        // 응답 타입
        plugin.setResponseType(Plugin.ResponseType.JSON);

        // 사용자가 직접 데이터소스 생성 가능하도록 설정
        plugin.setAllowUserDatasources(true);

        // 기본 설치 플러그인으로 설정 (모든 워크스페이스에 자동 설치)
        plugin.setDefaultInstall(true);

        // 문서 링크
        plugin.setDocumentationLink("https://www.daouoffice.com");

        // 아이콘 (선택사항 - 나중에 추가 가능)
        // plugin.setIconLocation("https://assets.appsmith.com/logo/daouoffice.svg");

        try {
            mongoTemplate.insert(plugin);
            log.info("✅ Daouoffice plugin successfully added to database");

            // 모든 워크스페이스에 플러그인 설치
            assert plugin.getId() != null;
            installPluginToAllWorkspaces(mongoTemplate, plugin.getId());
            log.info("✅ Daouoffice plugin installed to all workspaces");

        } catch (DuplicateKeyException e) {
            log.warn("⚠️ Daouoffice plugin already exists in database");
        } catch (Exception e) {
            log.error("❌ Failed to add Daouoffice plugin", e);
            throw e;
        }
    }
}

