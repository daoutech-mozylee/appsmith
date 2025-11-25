package com.daou.dop.allapps.doserver.persistence.mapper;

import com.daou.dop.allapps.doserver.persistence.entity.organization.Member;
import com.daou.dop.allapps.doserver.provision.organization.dto.OrgMemberDto;

public class MemberMapper {

    public static Member toEntity(OrgMemberDto dto) {
        return Member.builder()
            .id(dto.getId())
            .userId(dto.getUserId())
            .departmentId(dto.getDepartmentId())
            .dutyCodeId(dto.getDutyCodeId())
            .memberType(dto.getMemberType())
            .sortOrder(dto.getSortOrder())
            .departmentOrder(dto.getDepartmentOrder())
            .build();
    }

    public static void applyToEntity(Member entity, OrgMemberDto dto) {
        entity.setUserId(dto.getUserId());
        entity.setDepartmentId(dto.getDepartmentId());
        entity.setDutyCodeId(dto.getDutyCodeId());
        entity.setMemberType(dto.getMemberType());
        entity.setSortOrder(dto.getSortOrder());
        entity.setDepartmentOrder(dto.getDepartmentOrder());
    }
}
