package com.daou.dop.allapps.doserver.provision.organization;

import com.daou.dop.allapps.doserver.provision.organization.dto.OrgMemberDto;
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
public class SyncMemberUsecase {

    private final OrgSyncPersistencePort orgSyncPersistencePort;
    private final OrgSyncBulkMutationPort orgSyncBulkMutationPort;

    /**
     * Snapshot 동기화: 전체 멤버 데이터를 받아서 upsert합니다.
     * @param companyId 회사 ID
     * @param orgMemberDtos 멤버 DTO 리스트
     */
    @Transactional
    public void syncSnapshotData(Long companyId, List<OrgMemberDto> orgMemberDtos) {
        if (CollectionUtils.isEmpty(orgMemberDtos)) {
            return;
        }

        upsertMembers(orgMemberDtos);
    }

    /**
     * 멤버(Member)를 upsert 합니다.
     * 멤버가 존재하지 않으면 생성하고, 존재하면 업데이트합니다.
     * @param orgMemberDtos 멤버 DTO 리스트
     */
    private void upsertMembers(List<OrgMemberDto> orgMemberDtos) {
        Map<Long, Boolean> existsMap = SupportUtils.loadExistingIdMap(orgMemberDtos, OrgMemberDto::getId,
            orgSyncPersistencePort::findExistingMemberIds);

        List<OrgMemberDto> newMemberDtos = new ArrayList<>();
        List<OrgMemberDto> existingMemberDtos = new ArrayList<>();

        for (OrgMemberDto memberDto : orgMemberDtos) {
            boolean exists = existsMap.getOrDefault(memberDto.getId(), false);
            if (!exists) { // DB에 없음 → 신규 대상
                memberDto.setNewTarget(true);
                newMemberDtos.add(memberDto);
            } else { // DB에 존재 → 업데이트 대상
                existingMemberDtos.add(memberDto);
            }
        }

        orgSyncBulkMutationPort.bulkInsertMembers(newMemberDtos);
        orgSyncBulkMutationPort.bulkUpdateMembers(existingMemberDtos);
    }

    /**
     * Snapshot에 존재하지 않는 Member를 삭제합니다.
     * @param companyId 회사 ID
     * @param snapshotMemberIds Snapshot에 존재하는 멤버 ID Set
     */
    @Transactional
    public void deleteSnapshotData(Long companyId, Set<Long> snapshotMemberIds) {
        if (CollectionUtils.isEmpty(snapshotMemberIds)) {
            return;
        }

        List<Long> deptIds = orgSyncPersistencePort.getDeptIdsByCompanyId(companyId);
        List<Long> dbIds = orgSyncPersistencePort.getMemberIdsByDeptIds(deptIds);
        Set<Long> toDelete = new HashSet<>(dbIds);
        toDelete.removeAll(snapshotMemberIds);

        if (toDelete.isEmpty()) {
            return;
        }

        orgSyncBulkMutationPort.bulkDeleteMembers(new ArrayList<>(toDelete));
    }
}
