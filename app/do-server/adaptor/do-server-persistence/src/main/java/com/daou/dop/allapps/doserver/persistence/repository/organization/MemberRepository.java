package com.daou.dop.allapps.doserver.persistence.repository.organization;

import com.daou.dop.allapps.doserver.persistence.entity.organization.Member;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MemberRepository extends JpaRepository<Member, Long> {

    List<Member> findByUserId(Long userId);

    List<Member> findByDepartmentId(Long departmentId);

    @Query("SELECT m FROM Member m WHERE m.userId IN :userIds")
    List<Member> findByUserIdIn(@Param("userIds") List<Long> userIds);

    @Query("SELECT m FROM Member m WHERE m.departmentId IN :departmentIds")
    List<Member> findByDepartmentIdIn(@Param("departmentIds") List<Long> departmentIds);

    @Query("SELECT m.id FROM Member m JOIN User u ON m.userId = u.id WHERE u.companyId = :companyId AND m.id IN :ids")
    List<Long> findExistingIdsByCompanyIdAndIds(@Param("companyId") Long companyId, @Param("ids") List<Long> ids);

    @Query("SELECT m.id FROM Member m JOIN User u ON m.userId = u.id WHERE u.companyId = :companyId")
    List<Long> findAllIdsByCompanyId(@Param("companyId") Long companyId);
}
