package com.daou.dop.allapps.doserver.provision.organization;

import com.daou.dop.allapps.doserver.provision.organization.dto.OrgUserDto;
import com.daou.dop.allapps.doserver.provision.organization.port.OrgSyncBulkMutationPort;
import com.daou.dop.allapps.doserver.provision.organization.port.OrgSyncPersistencePort;
import com.daou.dop.allapps.doserver.provision.organization.utils.SupportUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SyncUserUsecase {

    private final OrgSyncPersistencePort orgSyncPersistencePort;
    private final OrgSyncBulkMutationPort orgSyncBulkMutationPort;

    /**
     * Snapshot 동기화: 전체 사용자 데이터를 받아서 upsert합니다.
     * @param companyId 회사 ID
     * @param orgUserDtos 사용자 DTO 리스트
     */
    @Transactional
    public void syncSnapshotData(Long companyId, List<OrgUserDto> orgUserDtos) {
        if (CollectionUtils.isEmpty(orgUserDtos)) {
            return;
        }

        upsertUsers(companyId, orgUserDtos);
        deleteUsers(companyId, orgUserDtos);
    }

    /**
     * 사용자(User)를 upsert 합니다.
     * 사용자가 존재하지 않으면 생성하고, 존재하면 업데이트합니다.
     * @param companyId 회사 ID
     * @param orgUserDtos 사용자 DTO 리스트
     */
    private void upsertUsers(Long companyId, List<OrgUserDto> orgUserDtos) {
        Map<Long, Boolean> existsMap = SupportUtils.loadExistingIdMap(orgUserDtos, OrgUserDto::getId,
            ids -> orgSyncPersistencePort.findExistingUserIdsByCompany(companyId, ids));

        List<OrgUserDto> newUserDtos = new ArrayList<>();
        List<OrgUserDto> existingUserDtos = new ArrayList<>();

        for (OrgUserDto userDto : orgUserDtos) {
            boolean exists = existsMap.getOrDefault(userDto.getId(), false);
            if (!exists) { // DB에 없음 → 신규 대상
                userDto.setNewTarget(true);
                newUserDtos.add(userDto);
            } else { // DB에 존재 → 업데이트 대상
                existingUserDtos.add(userDto);
            }
        }

        orgSyncBulkMutationPort.bulkInsertUsers(companyId, newUserDtos);
        orgSyncBulkMutationPort.bulkUpdateUsers(existingUserDtos);
    }

    /**
     * Snapshot에 존재하지 않는 사용자를 삭제합니다.
     * @param companyId 회사 ID
     * @param snapshotUserDtos Snapshot에 존재하는 사용자 DTO 리스트
     */
    private void deleteUsers(Long companyId, List<OrgUserDto> snapshotUserDtos) {
        Set<Long> snapshotUserIds = snapshotUserDtos.stream()
            .map(OrgUserDto::getId)
            .collect(Collectors.toSet());

        List<Long> dbUserIds = orgSyncPersistencePort.getUserIdsByCompanyId(companyId);
        List<Long> userIdsToDelete = dbUserIds.stream()
            .filter(userId -> !snapshotUserIds.contains(userId))
            .collect(Collectors.toList());

        if (!userIdsToDelete.isEmpty()) {
            orgSyncBulkMutationPort.bulkDeleteUsers(companyId, userIdsToDelete);
        }
    }
}
