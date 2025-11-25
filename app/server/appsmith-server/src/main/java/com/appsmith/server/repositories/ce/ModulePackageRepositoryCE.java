package com.appsmith.server.repositories.ce;

import com.appsmith.server.domains.ModulePackage;
import com.appsmith.server.repositories.AppsmithRepository;
import com.appsmith.server.repositories.BaseRepository;
import com.appsmith.server.repositories.CustomModulePackageRepository;

public interface ModulePackageRepositoryCE
        extends BaseRepository<ModulePackage, String>,
                CustomModulePackageRepository,
                AppsmithRepository<ModulePackage> {}
