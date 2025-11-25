package com.appsmith.server.repositories.ce;

import com.appsmith.server.domains.UiModule;
import com.appsmith.server.repositories.AppsmithRepository;
import com.appsmith.server.repositories.BaseRepository;
import com.appsmith.server.repositories.CustomModuleRepository;

public interface ModuleRepositoryCE
        extends BaseRepository<UiModule, String>, CustomModuleRepository, AppsmithRepository<UiModule> {}
