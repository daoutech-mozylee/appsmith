package com.daou.dop.allapps.doserver.persistence.entity.organization;

import com.daou.dop.allapps.doserver.domain.type.OrganizationType;
import com.daou.dop.allapps.doserver.persistence.entity.BaseTimeEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;

@Entity
@Getter
@Setter
@Builder
@AllArgsConstructor(access = AccessLevel.PROTECTED)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(
    name = "organization_code",
    indexes = {
        @Index(name = "idx1_organization_code", columnList = "company_id"),
        @Index(name = "idx2_organization_code", columnList = "company_id, type")
    }
)
public class OrganizationCode extends BaseTimeEntity {

    @Id
    private Long id;

    @NotNull
    @Column(nullable = false, name = "company_id")
    private Long companyId;

    @Column(length = 255)
    private String name;

    @Column(length = 100)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(length = 50)
    private OrganizationType type;

    @ColumnDefault("1")
    @Column(name = "sort_order")
    private Integer sortOrder;
}
