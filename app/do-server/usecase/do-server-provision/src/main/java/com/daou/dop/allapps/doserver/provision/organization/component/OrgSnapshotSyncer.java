package com.daou.dop.allapps.doserver.provision.organization.component;

import com.daou.dop.allapps.doserver.provision.organization.*;
import com.daou.dop.allapps.doserver.provision.organization.dto.*;
import com.daou.dop.allapps.doserver.provision.organization.port.ProvisionFeignPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 전체 동기화 (Snapshot 기반)
 * 조직코드 -> 부서 -> 사용자 -> 멤버 순서로 동기화
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OrgSnapshotSyncer {

    private final ProvisionFeignPort provisionFeignPort;
    private final SyncOrganizationCodeUsecase syncOrganizationCodeUsecase;
    private final SyncDepartmentUsecase syncDepartmentUsecase;
    private final SyncUserUsecase syncUserUsecase;
    private final SyncMemberUsecase syncMemberUsecase;

    /**
     * Snapshot 동기화 (Feign을 통해 Provision Server에서 데이터 가져오기)
     * TODO: Phase B에서 구현 예정
     * @param companyUuid 회사 UUID
     * @param snapshotIds Snapshot ID 리스트
     * @return 마지막 처리된 Snapshot의 LogSeq
     */
    @Transactional
    public Long sync(String companyUuid, List<Long> snapshotIds) {
        log.info("[Snapshot 동기화] 시작, uuid={}, snapshotIds={}", companyUuid, snapshotIds);

        // TODO: Phase B에서 ProvisionFeignPort를 통해 실제 데이터를 가져와서 동기화
        // for (Long snapshotId : snapshotIds) {
        //     OrgSnapshotDto snapshot = provisionFeignPort.getSnapshotData(companyUuid, snapshotId);
        //     // 데이터 변환 후 syncSnapshot() 호출
        // }

        log.warn("[Snapshot 동기화] Phase B에서 구현 예정 (TODO)");
        return snapshotIds.isEmpty() ? null : snapshotIds.get(snapshotIds.size() - 1);
    }

    /**
     * Snapshot 동기화 (DTO를 직접 받아서 처리)
     * @param companyId 회사 ID
     * @param orgCodeDtos 조직코드 DTO 리스트
     * @param departmentDtos 부서 DTO 리스트
     * @param userDtos 사용자 DTO 리스트
     * @param memberDtos 멤버 DTO 리스트
     */
    @Transactional
    public void syncSnapshot(Long companyId,
                            List<OrgOrganizationCodeDto> orgCodeDtos,
                            List<OrgDepartmentDto> departmentDtos,
                            List<OrgUserDto> userDtos,
                            List<OrgMemberDto> memberDtos) {
        log.info("[Snapshot 동기화] 시작, companyId={}", companyId);

        Set<Long> snapshotOrgCodeIds = new HashSet<>();
        Set<Long> snapshotDeptIds = new HashSet<>();
        Set<Long> snapshotMemberIds = new HashSet<>();

        // 1. 조직코드 동기화
        if (!CollectionUtils.isEmpty(orgCodeDtos)) {
            log.info("[조직도 동기화] Snapshot 조직코드 시작, count={}", orgCodeDtos.size());
            syncOrganizationCodeUsecase.syncSnapshotData(companyId, orgCodeDtos);
            snapshotOrgCodeIds.addAll(orgCodeDtos.stream()
                .map(OrgOrganizationCodeDto::getId)
                .collect(Collectors.toSet()));
            log.info("[조직도 동기화] Snapshot 조직코드 종료");
        }

        // 2. 부서 동기화
        if (!CollectionUtils.isEmpty(departmentDtos)) {
            log.info("[조직도 동기화] Snapshot 부서 시작, count={}", departmentDtos.size());
            syncDepartmentUsecase.syncSnapshotData(companyId, departmentDtos);
            snapshotDeptIds.addAll(departmentDtos.stream()
                .map(OrgDepartmentDto::getId)
                .collect(Collectors.toSet()));
            log.info("[조직도 동기화] Snapshot 부서 종료");
        }

        // 3. 사용자 동기화
        if (!CollectionUtils.isEmpty(userDtos)) {
            log.info("[조직도 동기화] Snapshot 사용자 시작, count={}", userDtos.size());
            syncUserUsecase.syncSnapshotData(companyId, userDtos);
            log.info("[조직도 동기화] Snapshot 사용자 종료");
        }

        // 4. 멤버 동기화
        if (!CollectionUtils.isEmpty(memberDtos)) {
            log.info("[조직도 동기화] Snapshot 멤버 시작, count={}", memberDtos.size());
            syncMemberUsecase.syncSnapshotData(companyId, memberDtos);
            snapshotMemberIds.addAll(memberDtos.stream()
                .map(OrgMemberDto::getId)
                .collect(Collectors.toSet()));
            log.info("[조직도 동기화] Snapshot 멤버 종료");
        }

        // 5. 스냅샷에 없는 데이터 삭제 (멤버 -> 부서 -> 조직코드 순서 중요)
        if (!snapshotMemberIds.isEmpty()) {
            syncMemberUsecase.deleteSnapshotData(companyId, snapshotMemberIds);
        }
        if (!snapshotDeptIds.isEmpty()) {
            syncDepartmentUsecase.deleteSnapshotData(companyId, snapshotDeptIds);
        }
        if (!snapshotOrgCodeIds.isEmpty()) {
            syncOrganizationCodeUsecase.deleteSnapshotData(companyId, snapshotOrgCodeIds);
        }

        log.info("[Snapshot 동기화] 완료, companyId={}", companyId);
    }
}
