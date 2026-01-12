package com.appsmith.server.controllers;

import com.appsmith.server.constants.Url;
import com.appsmith.server.controllers.ce.UIModuleControllerCE;
import com.appsmith.server.services.UIModuleService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * UIModule 컨트롤러
 *
 * CE 패턴을 따르는 UIModule 컨트롤러입니다.
 *
 * Endpoints:
 * - GET /all-apps/api/v1/modules : 모듈 목록 조회
 * - GET /all-apps/api/v1/modules/{uuid} : 모듈 상세 조회
 * - POST /all-apps/api/v1/modules/upsert : 모듈 생성/수정
 * - DELETE /all-apps/api/v1/modules/{uuid} : 모듈 비활성화
 */
@Slf4j
@RestController
@RequestMapping(Url.UI_MODULE_URL)
public class UIModuleController extends UIModuleControllerCE {

    public UIModuleController(UIModuleService service) {
        super(service);
    }
}
