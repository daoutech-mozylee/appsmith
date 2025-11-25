package com.appsmith.server.repositories.ce;

import com.appsmith.server.acl.AclPermission;
import com.appsmith.server.domains.ModulePackage;
import com.appsmith.server.helpers.ce.bridge.Bridge;
import com.appsmith.server.repositories.BaseAppsmithRepositoryImpl;
import reactor.core.publisher.Flux;

public class CustomModulePackageRepositoryCEImpl extends BaseAppsmithRepositoryImpl<ModulePackage>
        implements CustomModulePackageRepositoryCE {

    @Override
    public Flux<ModulePackage> findByWorkspaceId(String workspaceId, AclPermission permission) {
        return queryBuilder()
                .criteria(Bridge.equal(ModulePackage.Fields.workspaceId, workspaceId))
                .permission(permission)
                .all();
    }
}
