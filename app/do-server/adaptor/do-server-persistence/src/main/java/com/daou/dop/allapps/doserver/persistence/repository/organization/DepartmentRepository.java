package com.daou.dop.allapps.doserver.persistence.repository.organization;

import com.daou.dop.allapps.doserver.domain.type.DepartmentStatus;
import com.daou.dop.allapps.doserver.persistence.entity.organization.Department;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DepartmentRepository extends JpaRepository<Department, Long> {

    List<Department> findByCompanyId(Long companyId);

    List<Department> findByCompanyIdAndStatus(Long companyId, DepartmentStatus status);

    List<Department> findByCompanyIdAndParentId(Long companyId, Long parentId);

    @Query("SELECT d.id FROM Department d WHERE d.companyId = :companyId AND d.id IN :ids")
    List<Long> findExistingIdsByCompanyIdAndIds(@Param("companyId") Long companyId, @Param("ids") List<Long> ids);

    @Query("SELECT d.id FROM Department d WHERE d.companyId = :companyId")
    List<Long> findAllIdsByCompanyId(@Param("companyId") Long companyId);
}
