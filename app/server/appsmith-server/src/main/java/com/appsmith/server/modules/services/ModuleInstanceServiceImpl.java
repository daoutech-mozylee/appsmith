package com.appsmith.server.modules.services;

import com.appsmith.external.dtos.DslExecutableDTO;
import com.appsmith.external.models.CreatorContextType;
import com.appsmith.external.models.Policy;
import com.appsmith.server.acl.AclPermission;
import com.appsmith.server.domains.Layout;
import com.appsmith.server.domains.ModuleInstance;
import com.appsmith.server.domains.ModulePackage;
import com.appsmith.server.domains.NewPage;
import com.appsmith.server.domains.UiModule;
import com.appsmith.server.dtos.ModuleDTO;
import com.appsmith.server.dtos.ModuleInstanceCreateDTO;
import com.appsmith.server.newpages.base.NewPageService;
import com.appsmith.server.repositories.ModuleInstanceRepository;
import com.appsmith.server.repositories.ModulePackageRepository;
import com.appsmith.server.repositories.ModuleRepository;
import com.appsmith.server.services.AnalyticsService;
import com.appsmith.server.services.BaseService;
import com.appsmith.server.solutions.PolicySolution;
import jakarta.validation.Validator;
import lombok.extern.slf4j.Slf4j;
import net.minidev.json.JSONObject;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Slf4j
public class ModuleInstanceServiceImpl extends BaseService<ModuleInstanceRepository, ModuleInstance, String>
        implements ModuleInstanceService {

    private final ModuleRepository moduleRepository;
    private final ModulePackageRepository modulePackageRepository;
    private final NewPageService newPageService;
    private final PolicySolution policySolution;

    public ModuleInstanceServiceImpl(
            Validator validator,
            ModuleInstanceRepository repository,
            AnalyticsService analyticsService,
            ModuleRepository moduleRepository,
            ModulePackageRepository modulePackageRepository,
            NewPageService newPageService,
            PolicySolution policySolution) {
        super(validator, repository, analyticsService);
        this.moduleRepository = moduleRepository;
        this.modulePackageRepository = modulePackageRepository;
        this.newPageService = newPageService;
        this.policySolution = policySolution;
    }

    @Override
    public Mono<ModuleInstance> createInstance(ModuleInstanceCreateDTO request) {
        Mono<UiModule> moduleMono = moduleRepository.findById(request.getSourceModuleId(), AclPermission.READ_MODULES);
        Mono<ModulePackage> packageMono = moduleMono.flatMap(uiModule -> modulePackageRepository.findById(
                uiModule.getPackageId(), AclPermission.PACKAGE_CREATE_MODULE_INSTANCES));
        Mono<NewPage> pageMono = newPageService.findById(request.getContextId(), AclPermission.MANAGE_PAGES);

        return Mono.zip(moduleMono, packageMono, pageMono)
                .flatMap(tuple -> buildInstance(tuple.getT1(), tuple.getT2(), tuple.getT3(), request))
                .flatMap(super::create)
                .doOnSuccess(created -> {
                    if (created != null) {
                        log.info(
                                "ModuleInstanceService:createInstance success id={} moduleId={} contextId={}",
                                created.getId(),
                                created.getModuleId(),
                                created.getContextId());
                    } else {
                        log.warn("ModuleInstanceService:createInstance completed with empty result");
                    }
                });
    }

    private Mono<ModuleInstance> buildInstance(
            UiModule module, ModulePackage modulePackage, NewPage page, ModuleInstanceCreateDTO request) {
        ModuleInstance instance = new ModuleInstance();
        instance.setSourceModuleId(module.getBaseIdOrFallback());
        instance.setModuleId(module.getId());
        setModuleMetadata(module, instance);
        instance.setModulePackageId(modulePackage.getId());
        instance.setWorkspaceId(modulePackage.getWorkspaceId());
        instance.setApplicationId(page.getApplicationId());
        instance.setContextId(request.getContextId());
        instance.setContextType(request.getContextType());
        instance.setName(request.getName());
        instance.setWidgetId(request.getWidgetId());
        instance.setInputBindings(request.getInputBindings());
        instance.setOutputBindings(request.getOutputBindings());
        Map<String, Policy> policyMap = policySolution.generateInheritedPoliciesFromSourcePolicies(
                module.getPolicyMap(), UiModule.class, ModuleInstance.class);
        instance.setPolicies(Set.copyOf(policyMap.values()));
        instance.setPolicyMap(policyMap);
        instance.setModuleDslSnapshots(extractModuleDslSnapshots(module));
        instance.setModuleLayoutOnLoadActions(extractModuleLayoutOnLoadActions(module));
        return Mono.just(instance);
    }

    private void setModuleMetadata(UiModule module, ModuleInstance instance) {
        if (module.getUnpublishedModule() != null) {
            instance.setModuleUUID(module.getUnpublishedModule().getModuleUUID());
        }
    }

    @Override
    public Flux<ModuleInstance> getInstancesForContext(String contextId, CreatorContextType contextType) {
        return repository.findByContext(contextId, contextType, AclPermission.READ_MODULE_INSTANCES);
    }

    @Override
    public Flux<ModuleInstance> getInstancesForModule(String moduleId) {
        return repository.findByModuleId(moduleId, AclPermission.READ_MODULE_INSTANCES);
    }

    private List<JSONObject> extractModuleDslSnapshots(UiModule module) {
        ModuleDTO moduleDTO = module.getUnpublishedModule();
        if (moduleDTO == null) {
            return Collections.emptyList();
        }

        List<Layout> layouts = moduleDTO.getLayouts();
        if (layouts == null || layouts.isEmpty()) {
            return Collections.emptyList();
        }

        return layouts.stream()
                .filter(layout -> layout != null && layout.getDsl() != null)
                .map(layout -> (JSONObject) layout.getDsl().clone())
                .collect(Collectors.toList());
    }

    private List<List<DslExecutableDTO>> extractModuleLayoutOnLoadActions(UiModule module) {
        ModuleDTO moduleDTO = module.getUnpublishedModule();
        if (moduleDTO == null) {
            return Collections.emptyList();
        }

        List<Layout> layouts = moduleDTO.getLayouts();
        if (layouts == null || layouts.isEmpty()) {
            return Collections.emptyList();
        }

        List<List<DslExecutableDTO>> actionSets = new ArrayList<>();
        for (Layout layout : layouts) {
            if (layout == null || layout.getLayoutOnLoadActions() == null) {
                continue;
            }

            for (Set<DslExecutableDTO> actionSet : layout.getLayoutOnLoadActions()) {
                if (actionSet == null || actionSet.isEmpty()) {
                    continue;
                }
                actionSets.add(new ArrayList<>(actionSet));
            }
        }

        return actionSets;
    }
}
