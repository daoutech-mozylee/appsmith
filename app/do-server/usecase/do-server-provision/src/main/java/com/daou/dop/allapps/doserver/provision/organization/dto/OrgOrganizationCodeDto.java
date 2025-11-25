package com.daou.dop.allapps.doserver.provision.organization.dto;

import com.daou.dop.allapps.doserver.domain.type.OrganizationType;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;
import org.apache.commons.lang3.StringUtils;

@Setter
@Getter
@Builder
public class OrgOrganizationCodeDto {

    private Long id;
    private Long companyId;
    private String name;
    private String code;
    private OrganizationType type;
    private Integer sortOrder;

    private boolean newTarget = false;
    private boolean deleteTarget = false;

    public static OrgOrganizationCodeDto newDto(Long orgCodeId, Long companyId) {
        return OrgOrganizationCodeDto.builder()
            .id(orgCodeId)
            .companyId(companyId)
            .newTarget(true)
            .sortOrder(1)
            .build();
    }

    public void updateName(String name) {
        this.name = name;
    }

    public void updateCode(String code) {
        this.code = code;
    }

    public void updateType(String type) {
        if (StringUtils.isBlank(type)) {
            this.type = null;
            return;
        }
        this.type = OrganizationType.valueOfTitle(type);
    }

    public void updateSortOrder(Integer sortOrder) {
        if (sortOrder != null) {
            this.sortOrder = sortOrder;
        }
    }

    public boolean isModified() {
        return newTarget || deleteTarget;
    }
}
