package com.appsmith.server.repositories.ce;

import com.appsmith.server.acl.AclPermission;
import com.appsmith.server.domains.ModulePackage;
import com.appsmith.server.repositories.AppsmithRepository;
import reactor.core.publisher.Flux;

public interface CustomModulePackageRepositoryCE extends AppsmithRepository<ModulePackage> {

    Flux<ModulePackage> findByWorkspaceId(String workspaceId, AclPermission permission);
}
