package com.appsmith.server.repositories.ce;

import com.appsmith.server.acl.AclPermission;
import com.appsmith.server.domains.UiModule;
import com.appsmith.server.repositories.AppsmithRepository;
import reactor.core.publisher.Flux;

public interface CustomModuleRepositoryCE extends AppsmithRepository<UiModule> {

    Flux<UiModule> findByPackageId(String packageId, AclPermission permission);

    Flux<UiModule> findByWorkspaceId(String workspaceId, AclPermission permission);
}
