package com.appsmith.server.repositories;

import com.appsmith.server.repositories.ce.CustomModulePackageRepositoryCEImpl;
import org.springframework.stereotype.Component;

@Component
public class CustomModulePackageRepositoryImpl extends CustomModulePackageRepositoryCEImpl
        implements CustomModulePackageRepository {}
