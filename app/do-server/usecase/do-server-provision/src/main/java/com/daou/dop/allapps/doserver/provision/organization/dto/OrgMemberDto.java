package com.daou.dop.allapps.doserver.provision.organization.dto;

import com.daou.dop.allapps.doserver.domain.type.MemberType;
import lombok.*;
import org.apache.commons.lang3.StringUtils;

@Setter
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PROTECTED)
public class OrgMemberDto {

    private Long id;
    private Long userId;
    private Long departmentId;
    private Long dutyCodeId;
    private MemberType memberType;
    private Integer sortOrder;
    private Integer departmentOrder;

    private boolean newTarget = false;
    private boolean deleteTarget = false;

    public static OrgMemberDto newDto(Long memberId) {
        return OrgMemberDto.builder()
            .id(memberId)
            .newTarget(true)
            .memberType(MemberType.TEAM_MEMBER)
            .sortOrder(1)
            .departmentOrder(1)
            .build();
    }

    public void updateUserId(Long userId) {
        this.userId = userId;
    }

    public void updateDepartmentId(Long deptId) {
        this.departmentId = deptId;
    }

    public void updateDutyCodeId(Long dutyCodeId) {
        this.dutyCodeId = dutyCodeId;
    }

    public void updateMemberType(String memberType) {
        if (StringUtils.isBlank(memberType)) {
            this.memberType = MemberType.TEAM_MEMBER;
            return;
        }
        this.memberType = MemberType.valueOfTitle(memberType);
    }

    public void updateSortOrder(Integer sortOrder) {
        if (sortOrder != null) {
            this.sortOrder = sortOrder;
        }
    }

    public void updateDepartmentOrder(Integer deptOrder) {
        if (deptOrder != null) {
            this.departmentOrder = deptOrder;
        }
    }

    public boolean isModified() {
        return newTarget || deleteTarget;
    }
}
