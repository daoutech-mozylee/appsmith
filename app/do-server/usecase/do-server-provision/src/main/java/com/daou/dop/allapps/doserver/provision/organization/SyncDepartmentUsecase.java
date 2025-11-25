package com.daou.dop.allapps.doserver.provision.organization;

import com.daou.dop.allapps.doserver.provision.organization.dto.OrgDepartmentDto;
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
public class SyncDepartmentUsecase {

    private final OrgSyncPersistencePort orgSyncPersistencePort;
    private final OrgSyncBulkMutationPort orgSyncBulkMutationPort;

    /**
     * Snapshot 동기화: 전체 부서 데이터를 받아서 upsert합니다.
     * @param companyId 회사 ID
     * @param orgDepartmentDtos 부서 DTO 리스트
     */
    @Transactional
    public void syncSnapshotData(Long companyId, List<OrgDepartmentDto> orgDepartmentDtos) {
        if (CollectionUtils.isEmpty(orgDepartmentDtos)) {
            return;
        }

        upsertDepartments(companyId, orgDepartmentDtos);
    }

    /**
     * 부서(Department)를 upsert 합니다.
     * 부서가 존재하지 않으면 생성하고, 존재하면 업데이트합니다.
     * @param companyId 회사 ID
     * @param orgDepartmentDtos 부서 DTO 리스트
     */
    private void upsertDepartments(Long companyId, List<OrgDepartmentDto> orgDepartmentDtos) {
        Map<Long, Boolean> existsMap = SupportUtils.loadExistingIdMap(orgDepartmentDtos, OrgDepartmentDto::getId,
            ids -> orgSyncPersistencePort.findExistingDeptIdsByCompany(companyId, ids));

        List<OrgDepartmentDto> newDeptDtos = new ArrayList<>();
        List<OrgDepartmentDto> existingDeptDtos = new ArrayList<>();

        for (OrgDepartmentDto dto : orgDepartmentDtos) {
            boolean exists = existsMap.getOrDefault(dto.getId(), false);
            if (!exists) { // DB에 없음 → 신규 대상
                dto.setNewTarget(true);
                newDeptDtos.add(dto);
            } else { // DB에 존재 → 업데이트 대상
                existingDeptDtos.add(dto);
            }
        }

        orgSyncBulkMutationPort.bulkInsertDepts(newDeptDtos);
        orgSyncBulkMutationPort.bulkUpdateDepts(existingDeptDtos);
    }

    /**
     * Snapshot에 존재하지 않는 Department를 삭제합니다.
     * @param companyId 회사 ID
     * @param snapshotDeptIds Snapshot에 존재하는 부서 ID Set
     */
    @Transactional
    public void deleteSnapshotData(Long companyId, Set<Long> snapshotDeptIds) {
        if (CollectionUtils.isEmpty(snapshotDeptIds)) {
            return;
        }

        List<Long> dbIds = orgSyncPersistencePort.getDeptIdsByCompanyId(companyId);
        Set<Long> toDelete = new HashSet<>(dbIds);
        toDelete.removeAll(snapshotDeptIds);

        if (toDelete.isEmpty()) {
            return;
        }

        orgSyncBulkMutationPort.bulkDeleteDepts(companyId, new ArrayList<>(toDelete));
    }
}
