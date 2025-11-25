package com.appsmith.server.controllers;

import com.appsmith.external.models.CreatorContextType;
import com.appsmith.server.constants.Url;
import com.appsmith.server.domains.ModuleInstance;
import com.appsmith.server.dtos.ModuleInstanceCreateDTO;
import com.appsmith.server.dtos.ResponseDTO;
import com.appsmith.server.modules.services.ModuleInstanceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.util.List;

@RestController
@RequestMapping(Url.MODULE_INSTANCE_URL)
@RequiredArgsConstructor
@Slf4j
public class ModuleInstanceController {

    private final ModuleInstanceService moduleInstanceService;

    @PostMapping
    public Mono<ResponseDTO<ModuleInstance>> createInstance(@Valid @RequestBody ModuleInstanceCreateDTO request) {
        log.info(
                "ModuleInstanceController:create sourceModuleId={} contextId={} widgetId={}",
                request.getSourceModuleId(),
                request.getContextId(),
                request.getWidgetId());
        return moduleInstanceService.createInstance(request).map(created -> {
            log.info("ModuleInstanceController:create success id={}", created.getId());
            return new ResponseDTO<>(HttpStatus.CREATED, created);
        });
    }

    @GetMapping("/context/{contextType}/{contextId}")
    public Mono<ResponseDTO<List<ModuleInstance>>> getInstancesForContext(
            @PathVariable String contextType, @PathVariable String contextId) {
        CreatorContextType creatorContextType = CreatorContextType.valueOf(contextType.toUpperCase());
        return moduleInstanceService
                .getInstancesForContext(contextId, creatorContextType)
                .collectList()
                .map(instances -> new ResponseDTO<>(HttpStatus.OK, instances));
    }

    @GetMapping("/module/{moduleId}")
    public Mono<ResponseDTO<List<ModuleInstance>>> getInstancesForModule(@PathVariable String moduleId) {
        return moduleInstanceService
                .getInstancesForModule(moduleId)
                .collectList()
                .map(instances -> new ResponseDTO<>(HttpStatus.OK, instances));
    }
}
