package com.daou.dop.allapps.doserver.internal.feign.stub;

import com.daou.dop.allapps.doserver.provision.organization.dto.OrgSequenceDto;
import com.daou.dop.allapps.doserver.provision.organization.dto.OrgSnapshotDto;
import com.daou.dop.allapps.doserver.provision.organization.port.ProvisionFeignPort;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * ProvisionFeignPort의 임시 Stub 구현
 * 실제 프로비저닝 서버 API 연동 전까지 사용
 */
@Slf4j
@Component
public class StubProvisionFeignPort implements ProvisionFeignPort {

    @Override
    public OrgSequenceDto getSequenceData(String companyUuid, Long logSeq) {
        log.warn("[Stub] getSequenceData 호출됨 - 실제 구현 필요, uuid={}, logSeq={}", companyUuid, logSeq);

        // 테스트용: 항상 Snapshot 동기화가 필요하다고 응답
        return OrgSequenceDto.builder()
            .logSeq(logSeq)
            .needSnapshot(true)
            .snapshotIdList(List.of(1L, 2L))  // 테스트용 Snapshot ID
            .needUpdateNextLog(false)
            .build();
    }

    @Override
    public OrgSnapshotDto getSnapshotData(String companyUuid, Long snapshotId) {
        log.warn("[Stub] getSnapshotData 호출됨 - 실제 구현 필요, uuid={}, snapshotId={}", companyUuid, snapshotId);

        // 테스트용: 더미 스냅샷 데이터 반환
        return OrgSnapshotDto.builder()
            .snapshotId(snapshotId)
            .logSeq(snapshotId * 100)  // snapshotId 1 -> logSeq 100, snapshotId 2 -> logSeq 200
            .build();
    }
}
