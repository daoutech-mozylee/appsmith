package com.appsmith.server.controllers;

import com.appsmith.server.constants.Url;
import com.appsmith.server.domains.ModulePackage;
import com.appsmith.server.dtos.ModulePackageResponseDTO;
import com.appsmith.server.dtos.ResponseDTO;
import com.appsmith.server.modules.services.ModulePackageService;
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
@RequestMapping(Url.MODULE_PACKAGE_URL)
@RequiredArgsConstructor
@Slf4j
public class ModulePackageController {

    private final ModulePackageService modulePackageService;

    @PostMapping
    public Mono<ResponseDTO<ModulePackage>> create(@Valid @RequestBody ModulePackage modulePackage) {
        log.info(
                "ModulePackageController:create workspaceId={} name={}",
                modulePackage.getWorkspaceId(),
                modulePackage.getName());
        return modulePackageService.createModulePackage(modulePackage).map(created -> {
            log.info(
                    "ModulePackageController:create success id={} workspaceId={}",
                    created.getId(),
                    created.getWorkspaceId());
            return new ResponseDTO<>(HttpStatus.CREATED, created);
        });
    }

    @GetMapping("/workspace/{workspaceId}")
    public Mono<ResponseDTO<List<ModulePackage>>> getWorkspacePackages(@PathVariable String workspaceId) {
        return modulePackageService
                .getPackagesForWorkspace(workspaceId)
                .collectList()
                .map(packages -> new ResponseDTO<>(HttpStatus.OK, packages));
    }

    @GetMapping("/{packageId}")
    public Mono<ResponseDTO<ModulePackageResponseDTO>> getPackageView(@PathVariable String packageId) {
        log.info("ModulePackageController:getPackageView packageId={}", packageId);
        return modulePackageService.getPackageView(packageId).map(response -> {
            log.info(
                    "ModulePackageController:getPackageView success packageId={} modules={} instances={}",
                    packageId,
                    response.getModules() != null ? response.getModules().size() : 0,
                    response.getModuleInstances() != null
                            ? response.getModuleInstances().size()
                            : 0);
            return new ResponseDTO<>(HttpStatus.OK, response);
        });
    }
}
