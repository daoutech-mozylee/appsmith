package com.daou.dop.allapps.doserver.provision.organization.component;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.function.Supplier;

/**
 * 회사별 동기화 락 관리
 * 실제 구현은 Persistence 레이어에서 진행
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CompanyLockManager {

    // TODO: 실제 락 구현체 주입 필요
    // private final CompanyLockPort companyLockPort;

    public <T> boolean executeWithLock(String companyUuid, Supplier<T> task) {
        // TODO: 실제 락 로직 구현
        // 현재는 간단하게 항상 실행
        log.debug("[CompanyLockManager] 락 획득 시도, uuid={}", companyUuid);
        try {
            task.get();
            log.debug("[CompanyLockManager] 작업 완료, uuid={}", companyUuid);
            return true;
        } catch (Exception e) {
            log.error("[CompanyLockManager] 작업 실패, uuid={}", companyUuid, e);
            return false;
        }
    }
}
