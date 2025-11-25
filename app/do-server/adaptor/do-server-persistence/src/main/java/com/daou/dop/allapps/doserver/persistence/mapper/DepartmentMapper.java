package com.daou.dop.allapps.doserver.persistence.mapper;

import com.daou.dop.allapps.doserver.persistence.entity.organization.Department;
import com.daou.dop.allapps.doserver.provision.organization.dto.OrgDepartmentDto;

public class DepartmentMapper {

    public static Department toEntity(OrgDepartmentDto dto) {
        return Department.builder()
            .id(dto.getId())
            .companyId(dto.getCompanyId())
            .name(dto.getName())
            .parentId(dto.getParentId())
            .code(dto.getCode())
            .alias(dto.getAlias())
            .email(dto.getEmail())
            .status(dto.getStatus())
            .sortOrder(dto.getSortOrder())
            .departmentPath(dto.getDepartmentPath())
            .deletedAt(dto.getDeletedAt())
            .build();
    }

    public static void applyToEntity(Department entity, OrgDepartmentDto dto) {
        entity.setName(dto.getName());
        entity.setParentId(dto.getParentId());
        entity.setCode(dto.getCode());
        entity.setAlias(dto.getAlias());
        entity.setEmail(dto.getEmail());
        entity.setStatus(dto.getStatus());
        entity.setSortOrder(dto.getSortOrder());
        entity.setDepartmentPath(dto.getDepartmentPath());
        entity.setDeletedAt(dto.getDeletedAt());
    }
}
