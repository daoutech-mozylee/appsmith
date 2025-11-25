package com.daou.dop.allapps.doserver.provision.organization.dto;

import com.daou.dop.allapps.doserver.domain.type.DepartmentStatus;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Setter
@Getter
@Builder
public class OrgDepartmentDto {

    private Long id;
    private Long companyId;
    private String name;
    private Long parentId;
    private String code;
    private String alias;
    private String email;
    private DepartmentStatus status;
    private Integer sortOrder;
    private String departmentPath;
    private LocalDateTime deletedAt;

    private boolean newTarget = false;
    private boolean deleteTarget = false;

    public static OrgDepartmentDto newDto(Long deptId, Long companyId) {
        return OrgDepartmentDto.builder()
            .id(deptId)
            .companyId(companyId)
            .newTarget(true)
            .status(DepartmentStatus.ACTIVE)
            .sortOrder(1)
            .build();
    }

    public boolean isDeleted() {
        return DepartmentStatus.PERMANENTLY_DELETED.equals(status);
    }

    public void updateDepartmentPath() {
        this.departmentPath = (this.parentId == null) ? getId() + "." : null;
    }

    public void updateName(String name) {
        this.name = name;
    }

    public void updateParentId(Long parentId) {
        this.parentId = parentId;
    }

    public void updateCode(String code) {
        this.code = code;
    }

    public void updateAlias(String alias) {
        this.alias = alias;
    }

    public void updateEmail(String email) {
        this.email = email;
    }

    public void updateStatus(String statusStr) {
        if (statusStr != null) {
            try {
                this.status = DepartmentStatus.valueOf(statusStr);
            } catch (IllegalArgumentException e) {
                this.status = DepartmentStatus.ACTIVE;
            }
        }
    }

    public void updateSortOrder(Integer sortOrder) {
        if (sortOrder != null) {
            this.sortOrder = sortOrder;
        }
    }

    public void markAsDeleted() {
        this.deletedAt = LocalDateTime.now();
        this.status = DepartmentStatus.PERMANENTLY_DELETED;
        this.deleteTarget = true;
    }

    public boolean isModified() {
        return newTarget || deleteTarget;
    }
}
