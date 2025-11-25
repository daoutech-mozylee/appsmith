package com.daou.dop.allapps.doserver.provision.organization;

import com.daou.dop.allapps.doserver.provision.organization.dto.OrgOrganizationCodeDto;
import com.daou.dop.allapps.doserver.provision.organization.port.OrgSyncBulkMutationPort;
import com.daou.dop.allapps.doserver.provision.organization.port.OrgSyncPersistencePort;
import com.daou.dop.allapps.doserver.provision.organization.utils.SupportUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class SyncOrganizationCodeUsecase {

    private final OrgSyncPersistencePort orgSyncPersistencePort;
    private final OrgSyncBulkMutationPort orgSyncBulkMutationPort;

    /**
     * Snapshot 동기화: 전체 조직코드 데이터를 받아서 upsert합니다.
     * @param companyId 회사 ID
     * @param orgCodeDtos 조직코드 DTO 리스트
     */
    @Transactional
    public void syncSnapshotData(Long companyId, List<OrgOrganizationCodeDto> orgCodeDtos) {
        if (CollectionUtils.isEmpty(orgCodeDtos)) {
            return;
        }

        upsertOrgCodes(companyId, orgCodeDtos);
    }

    /**
     * 조직코드(OrganizationCode)를 upsert 합니다.
     * 조직코드가 존재하지 않으면 생성하고, 존재하면 업데이트합니다.
     * @param companyId 회사 ID
     * @param orgCodeDtos OrganizationCode DTO 리스트
     */
    private void upsertOrgCodes(Long companyId, List<OrgOrganizationCodeDto> orgCodeDtos) {
        Map<Long, Boolean> existsMap = SupportUtils.loadExistingIdMap(orgCodeDtos, OrgOrganizationCodeDto::getId,
            ids -> orgSyncPersistencePort.findExistingOrgCodeIdsByCompany(companyId, ids));

        List<OrgOrganizationCodeDto> newOrgCodeDtos = new ArrayList<>();
        List<OrgOrganizationCodeDto> existingOrgCodeDtos = new ArrayList<>();

        for (OrgOrganizationCodeDto orgCodeDto : orgCodeDtos) {
            boolean exists = existsMap.getOrDefault(orgCodeDto.getId(), false);
            if (!exists) { // DB에 없음 → 신규 대상
                orgCodeDto.setNewTarget(true);
                newOrgCodeDtos.add(orgCodeDto);
            } else { // DB에 존재 → 업데이트 대상
                existingOrgCodeDtos.add(orgCodeDto);
            }
        }

        orgSyncBulkMutationPort.bulkInsertOrgCodes(newOrgCodeDtos);
        orgSyncBulkMutationPort.bulkUpdateOrgCodes(companyId, existingOrgCodeDtos);
    }

    /**
     * Snapshot에 존재하지 않는 OrganizationCode를 삭제합니다.
     * @param companyId 회사 ID
     * @param snapshotOrgCodeIds Snapshot에 존재하는 조직코드 ID Set
     */
    @Transactional
    public void deleteSnapshotData(Long companyId, Set<Long> snapshotOrgCodeIds) {
        if (CollectionUtils.isEmpty(snapshotOrgCodeIds)) {
            return;
        }

        List<Long> dbIds = orgSyncPersistencePort.getOrgCodeIdsByCompanyId(companyId);
        Set<Long> toDelete = new HashSet<>(dbIds);
        toDelete.removeAll(snapshotOrgCodeIds);

        if (toDelete.isEmpty()) {
            return;
        }

        orgSyncBulkMutationPort.bulkDeleteOrgCodes(companyId, new ArrayList<>(toDelete));
    }
}
