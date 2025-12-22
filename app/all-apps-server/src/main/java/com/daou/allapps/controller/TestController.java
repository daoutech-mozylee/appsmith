package com.daou.allapps.controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api")
public class TestController {

    @GetMapping("/my-info")
    public ResponseEntity<Map<String, Object>> myInfo(HttpServletRequest request) {
        Map<String, Object> response = new LinkedHashMap<>();

        // Request Info
        response.put("method", request.getMethod());
        response.put("requestURI", request.getRequestURI());
        response.put("remoteAddr", request.getRemoteAddr());

        // All Headers
        Map<String, String> headers = new LinkedHashMap<>();
        Enumeration<String> headerNames = request.getHeaderNames();
        while (headerNames.hasMoreElements()) {
            String headerName = headerNames.nextElement();
            headers.put(headerName, request.getHeader(headerName));
        }
        response.put("headers", headers);

        // 로그 출력
        log.info("=== /api/my-info 요청 ===");
        log.info("Method: {}, URI: {}, RemoteAddr: {}",
                request.getMethod(), request.getRequestURI(), request.getRemoteAddr());
        headers.forEach((key, value) -> log.info("Header: {} = {}", key, value));
        log.info("=========================");

        return ResponseEntity.ok(response);
    }
}
