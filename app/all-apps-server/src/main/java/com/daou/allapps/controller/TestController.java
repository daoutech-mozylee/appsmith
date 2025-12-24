package com.daou.allapps.controller;

import com.daou.allapps.dto.AuthInfoDto;
import com.daou.allapps.dto.UserMyInfoDto;
import com.daou.allapps.service.UserMyInfoService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TestController {

    private final UserMyInfoService userMyInfoService;
    private final ObjectMapper objectMapper;

    @GetMapping("/my-info")
    public ResponseEntity<UserMyInfoDto> myInfo(HttpServletRequest request) {
        // All Headers
        Map<String, String> headers = new LinkedHashMap<>();
        Enumeration<String> headerNames = request.getHeaderNames();
        while (headerNames.hasMoreElements()) {
            String headerName = headerNames.nextElement();
            headers.put(headerName, request.getHeader(headerName));
        }

        // 로그 출력
        log.info("=== /api/my-info 요청 ===");
        log.info("Method: {}, URI: {}, RemoteAddr: {}",
                request.getMethod(), request.getRequestURI(), request.getRemoteAddr());
        headers.forEach((key, value) -> log.info("Header: {} = {}", key, value));

        String authInfoHeader = headers.get("x-auth-info");
        log.info("x-auth-info: {}", authInfoHeader);
        log.info("=========================");

        if (authInfoHeader == null || authInfoHeader.isBlank()) {
            log.warn("x-auth-info 헤더 없음");
            return ResponseEntity.badRequest().build();
        }

        try {
            AuthInfoDto authInfo = objectMapper.readValue(authInfoHeader, AuthInfoDto.class);
            log.info("AuthInfo 파싱 완료: {}", authInfo);

            UserMyInfoDto userMyInfo = userMyInfoService.getUserMyInfo(authInfo.getCompanyUuid(), authInfo.getUserId());
            return ResponseEntity.ok(userMyInfo);
        } catch (JsonProcessingException e) {
            log.error("x-auth-info 파싱 실패", e);
            return ResponseEntity.badRequest().build();
        }
    }
}
