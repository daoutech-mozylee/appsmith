package com.daou.dop.allapps.doserver.persistence.entity.provision;

import com.daou.dop.allapps.doserver.domain.type.OrgSyncEventMsgStatus;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDateTime;

@Entity
@Getter
@Builder
@AllArgsConstructor(access = AccessLevel.PROTECTED)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@EntityListeners(AuditingEntityListener.class)
@Table(
    name = "org_sync_event_message",
    uniqueConstraints = {
        @UniqueConstraint(name = "uk1_org_sync_event_msg", columnNames = {"company_uuid", "log_seq"})
    },
    indexes = {
        @Index(name = "idx1_org_sync_event_msg", columnList = "status"),
        @Index(name = "idx2_org_sync_event_msg", columnList = "company_uuid, status"),
        @Index(name = "idx3_org_sync_event_msg", columnList = "company_uuid, status, log_seq"),
        @Index(name = "idx4_org_sync_event_msg", columnList = "status, company_uuid, updated_at")
    }
)
public class OrgSyncEventMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NonNull
    @Column(nullable = false, name = "company_uuid")
    private String companyUuid;

    @Column(name = "log_seq")
    private Long logSeq;

    @Setter
    @NonNull
    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private OrgSyncEventMsgStatus status = OrgSyncEventMsgStatus.PENDING;

    @Setter
    @Column(nullable = false, name = "retry_count")
    private int retryCount = 0;

    @CreatedDate
    @Column(nullable = false, updatable = false, name = "created_at")
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(nullable = false, name = "updated_at")
    private LocalDateTime updatedAt;
}
