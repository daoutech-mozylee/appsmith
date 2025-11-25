package com.daou.dop.allapps.doserver.persistence.entity.organization;

import com.daou.dop.allapps.doserver.domain.type.MemberType;
import com.daou.dop.allapps.doserver.persistence.entity.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;

@Entity
@Getter
@Setter
@Builder
@AllArgsConstructor(access = AccessLevel.PROTECTED)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(
    name = "member",
    indexes = {
        @Index(name = "idx1_member", columnList = "user_id"),
        @Index(name = "idx2_member", columnList = "department_id"),
        @Index(name = "idx3_member", columnList = "user_id, department_id")
    }
)
public class Member extends BaseTimeEntity {

    @Id
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "department_id", nullable = false)
    private Long departmentId;

    @Column(name = "duty_code_id")
    private Long dutyCodeId;

    @Enumerated(value = EnumType.STRING)
    @ColumnDefault("'TEAM_MEMBER'")
    @Column(name = "member_type", length = 50)
    private MemberType memberType;

    @ColumnDefault("1")
    @Column(name = "sort_order")
    private Integer sortOrder;

    @ColumnDefault("1")
    @Column(name = "department_order")
    private Integer departmentOrder;
}
