package com.appsmith.server.services;

import com.appsmith.server.repositories.UIModuleRepository;
import com.appsmith.server.services.ce.UIModuleServiceCEImpl;
import org.springframework.stereotype.Service;

/**
 * UIModule 서비스 구현체
 *
 * CE 패턴을 따르는 UIModule 서비스입니다.
 */
@Service
public class UIModuleServiceImpl extends UIModuleServiceCEImpl implements UIModuleService {

    public UIModuleServiceImpl(UIModuleRepository repository) {
        super(repository);
    }
}
