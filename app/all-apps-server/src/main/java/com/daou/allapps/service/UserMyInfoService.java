package com.daou.allapps.service;

import com.daou.allapps.dto.UserMyInfoDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
public class UserMyInfoService {

    @Cacheable(value = "user:my-info", key = "#companyUuid + ':' + #userId")
    public UserMyInfoDto getUserMyInfo(String companyUuid, Long userId) {
        log.info("캐시 미스 - 원본 데이터 조회: companyUuid={}, userId={}", companyUuid, userId);
        // TODO: 실제 구현 시 DB 또는 외부 API 호출로 대체
        return UserMyInfoDto.builder()
                .userId(userId)
                .companyUuid(companyUuid)
                .userName("테스트유저")
                .position("사원")
                .myApps(List.of("app1", "app2"))
                .build();
    }
}
