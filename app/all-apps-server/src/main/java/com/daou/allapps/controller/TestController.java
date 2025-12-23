package com.daou.allapps.controller;

import com.daou.allapps.dto.UserMyInfoDto;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TestController {

    private final RedisTemplate<String, Object> redisTemplate;
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

        String companyUid = "TEST-COMPANY-UID";
        Long userId = 1L;

        String key = String.format("user:my-info:%s:%d", companyUid, userId);
        log.info("user infokey: {}", key);
        log.info("=========================");

        try {
            // 1. 캐시 조회
            Object cachedValue = redisTemplate.opsForValue().get(key);
            if (cachedValue != null) {
                return ResponseEntity.ok(objectMapper.readValue(cachedValue.toString(), UserMyInfoDto.class));
            }

            // 2. 캐시 미스 → 원본 조회 후 캐시 저장
            UserMyInfoDto userMyInfo = fetchUserFromSource(companyUid, userId);
            redisTemplate.opsForValue().set(key, objectMapper.writeValueAsString(userMyInfo), 1, TimeUnit.HOURS);

            return ResponseEntity.ok(userMyInfo);
        } catch (JsonProcessingException e) {
            log.error("JSON 처리 실패", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * 원본 데이터 조회 (DB/외부 API 대체용 더미)
     * TODO: 실제 구현 시 DB 또는 외부 API 호출로 대체
     */
    private UserMyInfoDto fetchUserFromSource(String companyUid, Long userId) {
        return UserMyInfoDto.builder()
                .userId(userId)
                .companyUid(companyUid)
                .userName("테스트유저")
                .position("사원")
                .myApps(List.of("app1", "app2"))
                .build();
    }
}
