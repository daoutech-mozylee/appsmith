package com.daou.dop.allapps.doserver.persistence.entity.organization;

import com.daou.dop.allapps.doserver.domain.type.DepartmentStatus;
import com.daou.dop.allapps.doserver.persistence.entity.BaseTimeEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@Builder
@AllArgsConstructor(access = AccessLevel.PROTECTED)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(
    name = "department",
    indexes = {
        @Index(name = "idx1_department", columnList = "company_id"),
        @Index(name = "idx2_department", columnList = "parent_id"),
        @Index(name = "idx3_department", columnList = "status"),
        @Index(name = "idx4_department", columnList = "company_id, status")
    }
)
public class Department extends BaseTimeEntity {

    @Id
    private Long id;

    @NotNull
    @Column(nullable = false, name = "company_id")
    private Long companyId;

    @Column(length = 255)
    private String name;

    @Column(name = "parent_id")
    private Long parentId;

    @Column(length = 100)
    private String code;

    @Column(length = 255)
    private String alias;

    @Column(length = 255)
    private String email;

    @NotNull
    @Column(nullable = false, length = 50)
    @ColumnDefault("'ACTIVE'")
    @Enumerated(EnumType.STRING)
    private DepartmentStatus status;

    @ColumnDefault("1")
    @Column(name = "sort_order")
    private Integer sortOrder;

    @Column(length = 1024, name = "department_path")
    private String departmentPath;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    public void updateDepartmentPath() {
        this.departmentPath = (this.parentId == null) ? getId() + "." : null;
    }

    public void markAsDeleted() {
        this.deletedAt = LocalDateTime.now();
        this.status = DepartmentStatus.PERMANENTLY_DELETED;
    }
}
