package com.appsmith.server.repositories.ce;

import com.appsmith.external.models.CreatorContextType;
import com.appsmith.server.acl.AclPermission;
import com.appsmith.server.domains.ModuleInstance;
import com.appsmith.server.repositories.AppsmithRepository;
import reactor.core.publisher.Flux;

public interface CustomModuleInstanceRepositoryCE extends AppsmithRepository<ModuleInstance> {

    Flux<ModuleInstance> findByContext(String contextId, CreatorContextType contextType, AclPermission permission);

    Flux<ModuleInstance> findByModuleId(String moduleId, AclPermission permission);

    Flux<ModuleInstance> findByPackageId(String packageId, AclPermission permission);
}
