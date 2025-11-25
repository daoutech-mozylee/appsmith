package com.appsmith.server.modules.services;

import com.appsmith.server.domains.UiModule;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface UiModuleService {

    Mono<UiModule> createModule(UiModule module);

    Mono<UiModule> updateModule(String moduleId, UiModule module);

    Mono<UiModule> getModule(String moduleId);

    Flux<UiModule> getModulesForPackage(String packageId);

    Flux<UiModule> getModulesForWorkspace(String workspaceId);
}
