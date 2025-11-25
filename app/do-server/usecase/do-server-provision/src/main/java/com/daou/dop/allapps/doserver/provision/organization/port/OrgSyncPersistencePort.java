package com.daou.dop.allapps.doserver.provision.organization.port;

import com.daou.dop.allapps.doserver.domain.type.OrgSyncEventMsgStatus;
import com.daou.dop.allapps.doserver.provision.organization.dto.*;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface OrgSyncPersistencePort {

    void saveEventMessage(OrgSyncEventMessageDto dto);

    Optional<String> findPendingCompany();

    List<OrgSyncEventMessageDto> fetchPendingBatch(String companyUuid, int limit);

    void updateEventStatus(Long id, OrgSyncEventMsgStatus status);

    void saveFailedLog(String companyUuid, Long logSeq, String errorMessage);

    // OrganizationCode
    List<Long> getOrgCodeIdsByCompanyId(Long companyId);

    List<OrgOrganizationCodeDto> getAllOrgCodesByIdsAndCompany(Long companyId, Collection<Long> orgCodeIds);

    List<Long> findExistingOrgCodeIdsByCompany(Long companyId, Collection<Long> orgCodeIds);

    // Department
    List<Long> getDeptIdsByCompanyId(Long companyId);

    List<OrgDepartmentDto> getAllDeptsByIdsAndCompany(Long companyId, Collection<Long> departmentIds);

    List<Long> findExistingDeptIdsByCompany(Long companyId, List<Long> deptIds);

    // User
    List<Long> getUserIdsByCompanyId(Long companyId);

    List<OrgUserDto> getAllUsersByIdsAndCompany(Long companyId, Collection<Long> userIds);

    List<Long> findExistingUserIdsByCompany(Long companyId, List<Long> userIds);

    // Member
    List<OrgMemberDto> getAllMemberByIds(Collection<Long> memberIds);

    List<Long> findExistingMemberIds(List<Long> memberIds);

    List<Long> getMemberIdsByDeptIds(List<Long> deptIds);
}
