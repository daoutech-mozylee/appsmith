package com.appsmith.server.repositories;

import com.appsmith.server.repositories.ce.CustomModuleInstanceRepositoryCEImpl;
import org.springframework.stereotype.Component;

@Component
public class CustomModuleInstanceRepositoryImpl extends CustomModuleInstanceRepositoryCEImpl
        implements CustomModuleInstanceRepository {}
