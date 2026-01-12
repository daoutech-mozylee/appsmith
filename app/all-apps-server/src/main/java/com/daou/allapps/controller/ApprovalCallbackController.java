package com.daou.allapps.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * 전자결재 콜백 API 컨트롤러
 *
 * 콜백 URL 등록 시: https://{domain}/relay/api/approval/callback
 */
@Slf4j
@RestController
@RequestMapping("/api/approval")
public class ApprovalCallbackController {

    /**
     * 전자결재 시스템에서 호출하는 콜백 엔드포인트
     * 결재 상태가 변경될 때마다 호출됨
     *
     * POST /relay/api/approval/callback
     */
    @PostMapping("/callback")
    public ResponseEntity<Map<String, Object>> receiveCallback(@RequestBody String rawJson) {
        log.info("========== Approval Callback Received ==========");
        log.info("Raw JSON: {}", rawJson);
        log.info("================================================");

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Callback received successfully");

        return ResponseEntity.ok(response);
    }
}
