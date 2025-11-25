package com.appsmith.server.controllers;

import com.appsmith.server.constants.Url;
import com.appsmith.server.domains.UiModule;
import com.appsmith.server.dtos.ResponseDTO;
import com.appsmith.server.modules.services.UiModuleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.util.List;

@RestController
@RequestMapping(Url.MODULE_URL)
@RequiredArgsConstructor
@Slf4j
public class ModuleController {

    private final UiModuleService uiModuleService;

    @PostMapping
    public Mono<ResponseDTO<UiModule>> createModule(@Valid @RequestBody UiModule module) {
        log.info(
                "ModuleController:createModule workspaceId={} packageId={}",
                module.getWorkspaceId(),
                module.getPackageId());
        return uiModuleService.createModule(module).map(created -> {
            log.info("ModuleController:createModule success id={}", created.getId());
            return new ResponseDTO<>(HttpStatus.CREATED, created);
        });
    }

    @PutMapping("/{moduleId}")
    public Mono<ResponseDTO<UiModule>> updateModule(@PathVariable String moduleId, @RequestBody UiModule module) {
        return uiModuleService.updateModule(moduleId, module).map(updated -> new ResponseDTO<>(HttpStatus.OK, updated));
    }

    @GetMapping("/{moduleId}")
    public Mono<ResponseDTO<UiModule>> getModule(@PathVariable String moduleId) {
        log.info("ModuleController:getModule id={}", moduleId);
        return uiModuleService.getModule(moduleId).map(found -> {
            log.info("ModuleController:getModule success id={}", found.getId());
            return new ResponseDTO<>(HttpStatus.OK, found);
        });
    }

    @GetMapping("/package/{packageId}")
    public Mono<ResponseDTO<List<UiModule>>> getModulesForPackage(@PathVariable String packageId) {
        log.info("ModuleController:getModulesForPackage packageId={}", packageId);
        return uiModuleService.getModulesForPackage(packageId).collectList().map(modules -> {
            log.info("ModuleController:getModulesForPackage success packageId={} count={}", packageId, modules.size());
            return new ResponseDTO<>(HttpStatus.OK, modules);
        });
    }

    @GetMapping("/workspace/{workspaceId}")
    public Mono<ResponseDTO<List<UiModule>>> getModulesForWorkspace(@PathVariable String workspaceId) {
        log.info("ModuleController:getModulesForWorkspace workspaceId={}", workspaceId);
        return uiModuleService.getModulesForWorkspace(workspaceId).collectList().map(modules -> {
            log.info(
                    "ModuleController:getModulesForWorkspace success workspaceId={} count={}",
                    workspaceId,
                    modules.size());
            return new ResponseDTO<>(HttpStatus.OK, modules);
        });
    }
}
