package com.daou.dop.allapps.doserver.provision.organization;

import com.daou.dop.allapps.doserver.provision.organization.component.OrgSequenceSyncer;
import com.daou.dop.allapps.doserver.provision.organization.component.OrgSnapshotSyncer;
import com.daou.dop.allapps.doserver.provision.organization.dto.OrgSequenceDto;
import com.daou.dop.allapps.doserver.provision.organization.dto.OrgSyncEventMessageDto;
import com.daou.dop.allapps.doserver.provision.organization.port.OrgSyncPersistencePort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class OrganizationSyncUsecase {

    private final OrgSequenceSyncer orgSequenceSyncer;
    private final OrgSnapshotSyncer orgSnapshotSyncer;
    private final OrgSyncPersistencePort orgSyncPersistencePort;

    @Transactional
    public void createNewEventMsg(String companyUuid, Long logSeq) {
        OrgSyncEventMessageDto dto = OrgSyncEventMessageDto.builder()
            .companyUuid(companyUuid)
            .logSeq(logSeq)
            .build();

        orgSyncPersistencePort.saveEventMessage(dto);
    }

    @Transactional
    public void syncOrganizationChart(String companyUuid, Long logSeq) {
        log.info("[조직도 동기화] 시작, uuid={}, logSeq={}", companyUuid, logSeq);

        Long targetLogSeq = logSeq;
        boolean isUpdatable = true;
        boolean needAllCacheEvict = false;

        do {
            OrgSequenceDto result = orgSequenceSyncer.sync(companyUuid, targetLogSeq);

            if (Objects.isNull(result)) {
                break;
            }

            // Snapshot 동기화 필요 시
            if (result.isNeedSnapshot() && result.getSnapshotIdList() != null && !result.getSnapshotIdList().isEmpty()) {
                log.info("[조직도 동기화] Snapshot 동기화 필요, uuid={}", companyUuid);
                targetLogSeq = orgSnapshotSyncer.sync(companyUuid, result.getSnapshotIdList());
                needAllCacheEvict = true;
                continue;
            }

            targetLogSeq = result.getLogSeq();
            isUpdatable = result.isNeedUpdateNextLog();

        } while (isUpdatable);

        // TODO: 캐시 무효화 로직 추가
        if (needAllCacheEvict) {
            log.info("[조직도 동기화] 전체 캐시 무효화 필요, uuid={}", companyUuid);
        }

        log.info("[조직도 동기화] 완료, uuid={}, finalLogSeq={}", companyUuid, targetLogSeq);
    }
}
