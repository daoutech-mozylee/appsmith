package com.daou.dop.allapps.doserver.persistence.mapper;

import com.daou.dop.allapps.doserver.persistence.entity.organization.User;
import com.daou.dop.allapps.doserver.provision.organization.dto.OrgUserDto;

public class UserMapper {

    public static User toEntity(OrgUserDto dto) {
        return User.builder()
            .id(dto.getId())
            .companyId(dto.getCompanyId())
            .name(dto.getName())
            .loginId(dto.getLoginId())
            .status(dto.getStatus())
            .locale(dto.getLocale())
            .employeeNumber(dto.getEmployeeNumber())
            .mobileNumber(dto.getMobileNumber())
            .profileImagePath(dto.getProfileImagePath())
            .gradeCodeId(dto.getGradeCodeId())
            .positionCodeId(dto.getPositionCodeId())
            .dormantAt(dto.getDormantAt())
            .deletedAt(dto.getDeletedAt())
            .build();
    }

    public static void applyToEntity(User entity, OrgUserDto dto) {
        entity.setName(dto.getName());
        entity.setLoginId(dto.getLoginId());
        entity.setStatus(dto.getStatus());
        entity.setLocale(dto.getLocale());
        entity.setEmployeeNumber(dto.getEmployeeNumber());
        entity.setMobileNumber(dto.getMobileNumber());
        entity.setProfileImagePath(dto.getProfileImagePath());
        entity.setGradeCodeId(dto.getGradeCodeId());
        entity.setPositionCodeId(dto.getPositionCodeId());
        entity.setDormantAt(dto.getDormantAt());
        entity.setDeletedAt(dto.getDeletedAt());
    }
}
