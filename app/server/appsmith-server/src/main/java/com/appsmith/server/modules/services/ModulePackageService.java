package com.appsmith.server.modules.services;

import com.appsmith.server.domains.ModulePackage;
import com.appsmith.server.dtos.ModulePackageResponseDTO;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface ModulePackageService {

    Mono<ModulePackage> createModulePackage(ModulePackage modulePackage);

    Flux<ModulePackage> getPackagesForWorkspace(String workspaceId);

    Mono<ModulePackageResponseDTO> getPackageView(String packageId);
}
