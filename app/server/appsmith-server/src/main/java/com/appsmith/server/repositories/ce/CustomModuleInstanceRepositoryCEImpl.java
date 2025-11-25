package com.appsmith.server.repositories.ce;

import com.appsmith.external.models.CreatorContextType;
import com.appsmith.server.acl.AclPermission;
import com.appsmith.server.domains.ModuleInstance;
import com.appsmith.server.helpers.ce.bridge.Bridge;
import com.appsmith.server.repositories.BaseAppsmithRepositoryImpl;
import reactor.core.publisher.Flux;

public class CustomModuleInstanceRepositoryCEImpl extends BaseAppsmithRepositoryImpl<ModuleInstance>
        implements CustomModuleInstanceRepositoryCE {

    @Override
    public Flux<ModuleInstance> findByContext(
            String contextId, CreatorContextType contextType, AclPermission permission) {
        return queryBuilder()
                .criteria(Bridge.and(
                        Bridge.equal(ModuleInstance.Fields.contextId, contextId),
                        Bridge.equal(ModuleInstance.Fields.contextType, contextType)))
                .permission(permission)
                .all();
    }

    @Override
    public Flux<ModuleInstance> findByModuleId(String moduleId, AclPermission permission) {
        return queryBuilder()
                .criteria(Bridge.equal(ModuleInstance.Fields.moduleId, moduleId))
                .permission(permission)
                .all();
    }

    @Override
    public Flux<ModuleInstance> findByPackageId(String packageId, AclPermission permission) {
        return queryBuilder()
                .criteria(Bridge.equal(ModuleInstance.Fields.modulePackageId, packageId))
                .permission(permission)
                .all();
    }
}
