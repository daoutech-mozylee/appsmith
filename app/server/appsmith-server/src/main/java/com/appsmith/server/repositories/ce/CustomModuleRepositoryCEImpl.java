package com.appsmith.server.repositories.ce;

import com.appsmith.server.acl.AclPermission;
import com.appsmith.server.domains.UiModule;
import com.appsmith.server.helpers.ce.bridge.Bridge;
import com.appsmith.server.repositories.BaseAppsmithRepositoryImpl;
import reactor.core.publisher.Flux;

public class CustomModuleRepositoryCEImpl extends BaseAppsmithRepositoryImpl<UiModule>
        implements CustomModuleRepositoryCE {

    @Override
    public Flux<UiModule> findByPackageId(String packageId, AclPermission permission) {
        return queryBuilder()
                .criteria(Bridge.equal(UiModule.Fields.packageId, packageId))
                .permission(permission)
                .all();
    }

    @Override
    public Flux<UiModule> findByWorkspaceId(String workspaceId, AclPermission permission) {
        return queryBuilder()
                .criteria(Bridge.equal(UiModule.Fields.workspaceId, workspaceId))
                .permission(permission)
                .all();
    }
}
