package com.appsmith.server.services.ce;

import com.appsmith.server.dtos.UIModuleDTO;
import com.appsmith.server.dtos.UIModuleListDTO;
import com.appsmith.server.dtos.UIModuleResponseDTO;
import com.appsmith.server.dtos.UIPackageImportDTO;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.List;

/**
 * UIModule CE 서비스 인터페이스
 */
public interface UIModuleServiceCE {

    /**
     * 활성화된 모든 모듈 목록 조회
     *
     * @return 모듈 목록 (definition 제외)
     */
    Flux<UIModuleListDTO> getAllModules();

    /**
     * moduleUuid로 모듈 상세 조회
     *
     * @param moduleUuid 모듈 UUID
     * @return 모듈 상세 (definition 포함)
     */
    Mono<UIModuleResponseDTO> getModuleByUuid(String moduleUuid);

    /**
     * 모듈 생성 또는 업데이트 (Upsert)
     *
     * moduleUuid가 이미 존재하면 업데이트, 없으면 생성합니다.
     * 업데이트 시 버전이 자동으로 증가합니다.
     *
     * @param dto 모듈 데이터
     * @return 저장된 모듈 상세
     */
    Mono<UIModuleResponseDTO> upsertModule(UIModuleDTO dto);

    /**
     * 모듈 비활성화 (Soft Delete)
     *
     * enabled를 false로 설정합니다.
     *
     * @param moduleUuid 모듈 UUID
     * @return 완료 신호
     */
    Mono<Void> disableModule(String moduleUuid);

    /**
     * 패키지 JSON 일괄 Import
     *
     * 패키지 JSON 파일의 전체 구조를 받아서 모듈들을 일괄 등록합니다.
     * actionList와 actionCollectionList는 각 모듈의 definition에 자동으로 병합됩니다.
     *
     * @param packageDto 패키지 데이터
     * @return Import된 모듈 목록
     */
    Mono<List<UIModuleResponseDTO>> importPackage(UIPackageImportDTO packageDto);
}
