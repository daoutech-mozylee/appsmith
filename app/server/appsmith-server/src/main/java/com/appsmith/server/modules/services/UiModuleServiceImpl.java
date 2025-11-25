package com.appsmith.server.modules.services;

import com.appsmith.external.models.Policy;
import com.appsmith.server.acl.AclPermission;
import com.appsmith.server.domains.ModulePackage;
import com.appsmith.server.domains.UiModule;
import com.appsmith.server.dtos.ModuleDTO;
import com.appsmith.server.repositories.ModulePackageRepository;
import com.appsmith.server.repositories.ModuleRepository;
import com.appsmith.server.services.AnalyticsService;
import com.appsmith.server.services.BaseService;
import com.appsmith.server.solutions.PolicySolution;
import jakarta.validation.Validator;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.Set;

@Service
@Slf4j
public class UiModuleServiceImpl extends BaseService<ModuleRepository, UiModule, String> implements UiModuleService {

    private final ModulePackageRepository modulePackageRepository;
    private final PolicySolution policySolution;

    public UiModuleServiceImpl(
            Validator validator,
            ModuleRepository repository,
            AnalyticsService analyticsService,
            ModulePackageRepository modulePackageRepository,
            PolicySolution policySolution) {
        super(validator, repository, analyticsService);
        this.modulePackageRepository = modulePackageRepository;
        this.policySolution = policySolution;
    }

    @Override
    public Mono<UiModule> createModule(UiModule module) {
        return modulePackageRepository
                .findById(module.getPackageId(), AclPermission.PACKAGE_CREATE_MODULES)
                .flatMap(modulePackage -> applyPackageContext(module, modulePackage))
                .flatMap(super::create)
                .doOnSuccess(created -> {
                    if (created != null) {
                        log.info(
                                "UiModuleService:createModule success id={} packageId={}",
                                created.getId(),
                                created.getPackageId());
                    } else {
                        log.warn("UiModuleService:createModule completed with empty result");
                    }
                });
    }

    private Mono<UiModule> applyPackageContext(UiModule module, ModulePackage modulePackage) {
        module.setWorkspaceId(modulePackage.getWorkspaceId());
        module.setEvaluationVersion(modulePackage.getEvaluationVersion());
        Map<String, Policy> policyMap = policySolution.generateInheritedPoliciesFromSourcePolicies(
                modulePackage.getPolicyMap(), ModulePackage.class, UiModule.class);
        module.setPolicies(Set.copyOf(policyMap.values()));
        module.setPolicyMap(policyMap);
        ModuleDTO unpublished = module.getUnpublishedModule();
        if (unpublished != null) {
            unpublished.setPackageId(modulePackage.getId());
        }
        return Mono.just(module);
    }

    @Override
    public Mono<UiModule> updateModule(String moduleId, UiModule module) {
        return repository.updateById(moduleId, module, AclPermission.MANAGE_MODULES);
    }

    @Override
    public Mono<UiModule> getModule(String moduleId) {
        return repository.findById(moduleId, AclPermission.READ_MODULES);
    }

    @Override
    public Flux<UiModule> getModulesForPackage(String packageId) {
        return repository.findByPackageId(packageId, AclPermission.READ_MODULES);
    }

    @Override
    public Flux<UiModule> getModulesForWorkspace(String workspaceId) {
        return repository.findByWorkspaceId(workspaceId, AclPermission.READ_MODULES);
    }
}
