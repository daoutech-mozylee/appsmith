package com.appsmith.server.repositories;

import com.appsmith.server.repositories.ce.ModulePackageRepositoryCE;
import org.springframework.stereotype.Repository;

@Repository
public interface ModulePackageRepository extends ModulePackageRepositoryCE, CustomModulePackageRepository {}
