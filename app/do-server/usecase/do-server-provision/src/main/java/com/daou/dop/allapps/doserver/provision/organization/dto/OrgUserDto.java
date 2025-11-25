package com.daou.dop.allapps.doserver.provision.organization.dto;

import com.daou.dop.allapps.doserver.domain.type.UserStatus;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Setter
@Getter
@Builder
public class OrgUserDto {

    private Long id;
    private Long companyId;
    private String name;
    private String loginId;
    private UserStatus status;
    private String locale;
    private String employeeNumber;
    private String mobileNumber;
    private String profileImagePath;
    private Long gradeCodeId;
    private Long positionCodeId;
    private LocalDateTime dormantAt;
    private LocalDateTime deletedAt;

    private boolean newTarget = false;
    private boolean deleteTarget = false;

    public static OrgUserDto newDto(Long userId, Long companyId) {
        return OrgUserDto.builder()
            .id(userId)
            .companyId(companyId)
            .newTarget(true)
            .status(UserStatus.NORMAL)
            .locale("ko")
            .build();
    }

    public boolean isDeleted() {
        return UserStatus.DELETE.equals(status);
    }

    public void updateName(String name) {
        this.name = name;
    }

    public void updateLoginId(String loginId) {
        this.loginId = loginId;
    }

    public void updateStatus(String statusStr) {
        if (statusStr != null) {
            this.status = UserStatus.valueOfTitle(statusStr);
        }
    }

    public void updateLocale(String locale) {
        this.locale = locale;
    }

    public void updateEmployeeNumber(String employeeNumber) {
        this.employeeNumber = employeeNumber;
    }

    public void updateMobileNumber(String mobileNumber) {
        this.mobileNumber = mobileNumber;
    }

    public void updateProfileImagePath(String profileImagePath) {
        this.profileImagePath = profileImagePath;
    }

    public void updateGradeCodeId(Long gradeCodeId) {
        this.gradeCodeId = gradeCodeId;
    }

    public void updatePositionCodeId(Long positionCodeId) {
        this.positionCodeId = positionCodeId;
    }

    public void markAsDeleted() {
        this.deletedAt = LocalDateTime.now();
        this.status = UserStatus.DELETE;
        this.deleteTarget = true;
    }

    public boolean isModified() {
        return newTarget || deleteTarget;
    }
}
