package com.appsmith.server.modules.services;

import com.appsmith.external.models.CreatorContextType;
import com.appsmith.server.domains.ModuleInstance;
import com.appsmith.server.dtos.ModuleInstanceCreateDTO;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

public interface ModuleInstanceService {

    Mono<ModuleInstance> createInstance(ModuleInstanceCreateDTO request);

    Flux<ModuleInstance> getInstancesForContext(String contextId, CreatorContextType contextType);

    Flux<ModuleInstance> getInstancesForModule(String moduleId);
}
