package com.appsmith.server.controllers.ce;

import com.appsmith.external.views.Views;
import com.appsmith.server.constants.Url;
import com.appsmith.server.dtos.ResponseDTO;
import com.appsmith.server.dtos.UIModuleDTO;
import com.appsmith.server.dtos.UIModuleListDTO;
import com.appsmith.server.dtos.UIModuleResponseDTO;
import com.appsmith.server.services.UIModuleService;
import com.fasterxml.jackson.annotation.JsonView;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import reactor.core.publisher.Mono;

import java.util.List;

/**
 * UIModule CE 컨트롤러
 *
 * 모듈 CRUD API 엔드포인트를 제공합니다.
 *
 * Endpoints:
 * - GET /all-apps/api/v1/modules : 모듈 목록 조회
 * - GET /all-apps/api/v1/modules/{uuid} : 모듈 상세 조회
 * - POST /all-apps/api/v1/modules/upsert : 모듈 생성/수정
 * - DELETE /all-apps/api/v1/modules/{uuid} : 모듈 비활성화
 */
@Slf4j
@RequestMapping(Url.UI_MODULE_URL)
@RequiredArgsConstructor
public class UIModuleControllerCE {

    private final UIModuleService service;

    /**
     * 모듈 목록 조회
     *
     * 활성화된 모든 모듈의 목록을 반환합니다. (definition 제외)
     *
     * @return 모듈 목록
     */
    @JsonView(Views.Public.class)
    @GetMapping
    public Mono<ResponseDTO<List<UIModuleListDTO>>> getAllModules() {
        return service.getAllModules().collectList().map(modules -> new ResponseDTO<>(HttpStatus.OK, modules));
    }

    /**
     * 모듈 상세 조회
     *
     * moduleUuid로 모듈 상세를 조회합니다. (definition 포함)
     *
     * @param uuid 모듈 UUID
     * @return 모듈 상세
     */
    @JsonView(Views.Public.class)
    @GetMapping("/{uuid}")
    public Mono<ResponseDTO<UIModuleResponseDTO>> getModuleByUuid(@PathVariable String uuid) {
        return service.getModuleByUuid(uuid).map(module -> new ResponseDTO<>(HttpStatus.OK, module));
    }

    /**
     * 모듈 생성/수정 (Upsert)
     *
     * moduleUuid가 이미 존재하면 업데이트, 없으면 생성합니다.
     *
     * @param dto 모듈 데이터
     * @return 저장된 모듈 상세
     */
    @JsonView(Views.Public.class)
    @PostMapping("/upsert")
    public Mono<ResponseDTO<UIModuleResponseDTO>> upsertModule(@Valid @RequestBody UIModuleDTO dto) {
        return service.upsertModule(dto).map(module -> new ResponseDTO<>(HttpStatus.OK, module));
    }

    /**
     * 모듈 비활성화 (Soft Delete)
     *
     * 모듈의 enabled를 false로 설정합니다.
     *
     * @param uuid 모듈 UUID
     * @return 성공 응답
     */
    @JsonView(Views.Public.class)
    @DeleteMapping("/{uuid}")
    public Mono<ResponseDTO<Void>> disableModule(@PathVariable String uuid) {
        return service.disableModule(uuid).thenReturn(new ResponseDTO<>(HttpStatus.OK, null));
    }
}
