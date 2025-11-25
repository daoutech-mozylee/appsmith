package com.daou.dop.allapps.doserver.provision.organization.port;

import com.daou.dop.allapps.doserver.provision.organization.dto.OrgDepartmentDto;
import com.daou.dop.allapps.doserver.provision.organization.dto.OrgMemberDto;
import com.daou.dop.allapps.doserver.provision.organization.dto.OrgOrganizationCodeDto;
import com.daou.dop.allapps.doserver.provision.organization.dto.OrgUserDto;

import java.util.List;

public interface OrgSyncBulkMutationPort {

    void bulkOrgCodeChanges(Long companyId, List<OrgOrganizationCodeDto> modifiedOrgCodes);

    void bulkInsertOrgCodes(List<OrgOrganizationCodeDto> newOrgCodes);

    void bulkUpdateOrgCodes(Long companyId, List<OrgOrganizationCodeDto> existingOrgCodes);

    void bulkDeleteOrgCodes(Long companyId, List<Long> deleteIds);

    void bulkDeptChanges(Long companyId, List<OrgDepartmentDto> modifiedDepts);

    void bulkInsertDepts(List<OrgDepartmentDto> newDepts);

    void bulkUpdateDepts(List<OrgDepartmentDto> existingDepts);

    void bulkDeleteDepts(Long companyId, List<Long> deleteDeptIds);

    void bulkUserChanges(Long companyId, List<OrgUserDto> modifiedUsers);

    void bulkInsertUsers(Long companyId, List<OrgUserDto> newUsers);

    void bulkUpdateUsers(List<OrgUserDto> existingUsers);

    void bulkDeleteUsers(Long companyId, List<Long> deleteUserIds);

    void bulkMemberChanges(Long companyId, List<OrgMemberDto> modifiedMembers);

    void bulkInsertMembers(List<OrgMemberDto> newMembers);

    void bulkUpdateMembers(List<OrgMemberDto> existingMembers);

    void bulkDeleteMembers(List<Long> deleteMemberIds);
}
