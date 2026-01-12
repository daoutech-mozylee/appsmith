package com.appsmith.server.repositories;

import com.appsmith.server.repositories.ce.UIModuleRepositoryCE;
import org.springframework.stereotype.Repository;

/**
 * UIModule 리포지토리
 *
 * CE 패턴을 따르는 UIModule 리포지토리입니다.
 */
@Repository
public interface UIModuleRepository extends UIModuleRepositoryCE {}
