package com.appsmith.server.modules.services;

import com.appsmith.external.models.Policy;
import com.appsmith.server.acl.AclPermission;
import com.appsmith.server.constants.FieldName;
import com.appsmith.server.constants.ce.CommonConstantsCE;
import com.appsmith.server.domains.ModuleInstance;
import com.appsmith.server.domains.ModulePackage;
import com.appsmith.server.domains.UiModule;
import com.appsmith.server.domains.Workspace;
import com.appsmith.server.dtos.ModulePackageResponseDTO;
import com.appsmith.server.exceptions.AppsmithError;
import com.appsmith.server.exceptions.AppsmithException;
import com.appsmith.server.repositories.ModuleInstanceRepository;
import com.appsmith.server.repositories.ModulePackageRepository;
import com.appsmith.server.repositories.ModuleRepository;
import com.appsmith.server.services.AnalyticsService;
import com.appsmith.server.services.BaseService;
import com.appsmith.server.services.WorkspaceService;
import com.appsmith.server.solutions.PolicySolution;
import com.appsmith.server.solutions.WorkspacePermission;
import jakarta.validation.Validator;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@Slf4j
public class ModulePackageServiceImpl extends BaseService<ModulePackageRepository, ModulePackage, String>
        implements ModulePackageService {

    private final WorkspaceService workspaceService;
    private final WorkspacePermission workspacePermission;
    private final PolicySolution policySolution;
    private final ModuleRepository moduleRepository;
    private final ModuleInstanceRepository moduleInstanceRepository;

    public ModulePackageServiceImpl(
            Validator validator,
            ModulePackageRepository repository,
            AnalyticsService analyticsService,
            WorkspaceService workspaceService,
            WorkspacePermission workspacePermission,
            PolicySolution policySolution,
            ModuleRepository moduleRepository,
            ModuleInstanceRepository moduleInstanceRepository) {
        super(validator, repository, analyticsService);
        this.workspaceService = workspaceService;
        this.workspacePermission = workspacePermission;
        this.policySolution = policySolution;
        this.moduleRepository = moduleRepository;
        this.moduleInstanceRepository = moduleInstanceRepository;
    }

    @Override
    public Mono<ModulePackage> createModulePackage(ModulePackage modulePackage) {
        final AclPermission readWorkspacePermission = workspacePermission.getReadPermission();
        return workspacePermission
                .getPackageCreatePermission()
                .flatMap(requiredPermission -> workspaceService
                        .findById(modulePackage.getWorkspaceId(), readWorkspacePermission)
                        .switchIfEmpty(Mono.error(new AppsmithException(
                                AppsmithError.NO_RESOURCE_FOUND, FieldName.WORKSPACE, modulePackage.getWorkspaceId())))
                        .flatMap(workspace -> ensurePackageCreatePermission(workspace, requiredPermission)))
                .flatMap(workspace -> applyWorkspacePolicies(modulePackage, workspace))
                .flatMap(super::create)
                .doOnSuccess(created -> {
                    if (created != null) {
                        log.info(
                                "ModulePackageService:createModulePackage success id={} workspaceId={}",
                                created.getId(),
                                created.getWorkspaceId());
                    } else {
                        log.warn("ModulePackageService:createModulePackage completed with empty result");
                    }
                });
    }

    private Mono<Workspace> ensurePackageCreatePermission(Workspace workspace, AclPermission requiredPermission) {
        Set<String> userPermissions = workspace.getUserPermissions();
        if (userPermissions != null) {
            Set<String> acceptablePermissions = Set.of(
                    requiredPermission.getValue(),
                    AclPermission.MANAGE_WORKSPACES.getValue(),
                    AclPermission.WORKSPACE_MANAGE_PACKAGES.getValue(),
                    AclPermission.WORKSPACE_CREATE_PACKAGES.getValue());
            boolean hasPermission = userPermissions.stream().anyMatch(acceptablePermissions::contains);
            if (hasPermission) {
                return Mono.just(workspace);
            }
        }

        log.warn(
                "ModulePackageService:createModulePackage unauthorized workspaceId={} requiredPermission={}",
                workspace.getId(),
                requiredPermission.getValue());
        return Mono.error(new AppsmithException(AppsmithError.ACTION_IS_NOT_AUTHORIZED, "create module packages"));
    }

    private Mono<ModulePackage> applyWorkspacePolicies(ModulePackage modulePackage, Workspace workspace) {
        Map<String, Policy> policyMap = policySolution.generateInheritedPoliciesFromSourcePolicies(
                workspace.getPolicyMap(), Workspace.class, ModulePackage.class);
        modulePackage.setPolicies(Set.copyOf(policyMap.values()));
        modulePackage.setPolicyMap(policyMap);
        modulePackage.setEvaluationVersion(CommonConstantsCE.EVALUATION_VERSION);
        return Mono.just(modulePackage);
    }

    @Override
    public Flux<ModulePackage> getPackagesForWorkspace(String workspaceId) {
        return repository.findByWorkspaceId(workspaceId, AclPermission.READ_PACKAGES);
    }

    @Override
    public Mono<ModulePackageResponseDTO> getPackageView(String packageId) {
        Mono<ModulePackage> packageMono = repository.findById(packageId, AclPermission.READ_PACKAGES);
        Mono<List<UiModule>> modulesMono = moduleRepository
                .findByPackageId(packageId, AclPermission.READ_MODULES)
                .collectList();
        Mono<List<ModuleInstance>> instancesMono = moduleInstanceRepository
                .findByPackageId(packageId, AclPermission.READ_MODULE_INSTANCES)
                .collectList();

        return Mono.zip(packageMono, modulesMono, instancesMono).map(tuple -> {
            ModulePackageResponseDTO response = new ModulePackageResponseDTO();
            response.setPackageData(tuple.getT1());
            response.setModules(tuple.getT2());
            response.setModuleInstances(tuple.getT3());
            response.setModulesMetadata(List.of());
            return response;
        });
    }
}
