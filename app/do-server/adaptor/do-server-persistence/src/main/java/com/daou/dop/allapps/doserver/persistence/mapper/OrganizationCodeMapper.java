package com.daou.dop.allapps.doserver.persistence.mapper;

import com.daou.dop.allapps.doserver.persistence.entity.organization.OrganizationCode;
import com.daou.dop.allapps.doserver.provision.organization.dto.OrgOrganizationCodeDto;

public class OrganizationCodeMapper {

    public static OrganizationCode toEntity(OrgOrganizationCodeDto dto) {
        return OrganizationCode.builder()
            .id(dto.getId())
            .companyId(dto.getCompanyId())
            .name(dto.getName())
            .code(dto.getCode())
            .type(dto.getType())
            .sortOrder(dto.getSortOrder())
            .build();
    }

    public static void applyToEntity(OrganizationCode entity, OrgOrganizationCodeDto dto) {
        entity.setName(dto.getName());
        entity.setCode(dto.getCode());
        entity.setType(dto.getType());
        entity.setSortOrder(dto.getSortOrder());
    }
}
