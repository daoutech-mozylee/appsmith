package com.daou.dop.allapps.doserver.provision.organization.component;

import com.daou.dop.allapps.doserver.provision.organization.dto.OrgSequenceDto;
import com.daou.dop.allapps.doserver.provision.organization.port.ProvisionFeignPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 증분 동기화 (Sequence 기반)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrgSequenceSyncer {

    private final ProvisionFeignPort provisionFeignPort;

    @Transactional
    public OrgSequenceDto sync(String companyUuid, Long logSeq) {
        log.info("[Sequence 동기화] 시작, uuid={}, logSeq={}", companyUuid, logSeq);

        // 테스트용: Stub 호출
        OrgSequenceDto result = provisionFeignPort.getSequenceData(companyUuid, logSeq);

        log.info("[Sequence 동기화] Stub 응답 수신, needSnapshot={}", result.isNeedSnapshot());
        return result;
    }
}
