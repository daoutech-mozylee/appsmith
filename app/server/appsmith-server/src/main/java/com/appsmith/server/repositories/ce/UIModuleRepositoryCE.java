package com.appsmith.server.repositories.ce;

import com.appsmith.server.domains.UIModule;
import com.appsmith.server.repositories.BaseRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * UIModule CE 리포지토리 인터페이스
 */
@Repository
public interface UIModuleRepositoryCE extends BaseRepository<UIModule, String> {

    /**
     * moduleUuid로 모듈 조회
     */
    Mono<UIModule> findByModuleUuid(String moduleUuid);

    /**
     * 활성화된 모든 모듈 조회
     */
    Flux<UIModule> findAllByEnabledTrue();

    /**
     * moduleUuid와 활성화 상태로 모듈 조회
     */
    Mono<UIModule> findByModuleUuidAndEnabledTrue(String moduleUuid);

    /**
     * moduleName으로 모듈 조회
     */
    Mono<UIModule> findByModuleName(String moduleName);

    /**
     * packageUuid로 모듈 목록 조회
     */
    Flux<UIModule> findAllByPackageUuidAndEnabledTrue(String packageUuid);
}
