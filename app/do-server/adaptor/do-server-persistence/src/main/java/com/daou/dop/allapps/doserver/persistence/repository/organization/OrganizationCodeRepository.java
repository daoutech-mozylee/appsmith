package com.daou.dop.allapps.doserver.persistence.repository.organization;

import com.daou.dop.allapps.doserver.domain.type.OrganizationType;
import com.daou.dop.allapps.doserver.persistence.entity.organization.OrganizationCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OrganizationCodeRepository extends JpaRepository<OrganizationCode, Long> {

    List<OrganizationCode> findByCompanyId(Long companyId);

    List<OrganizationCode> findByCompanyIdAndType(Long companyId, OrganizationType type);

    @Query("SELECT oc.id FROM OrganizationCode oc WHERE oc.companyId = :companyId AND oc.id IN :ids")
    List<Long> findExistingIdsByCompanyIdAndIds(@Param("companyId") Long companyId, @Param("ids") List<Long> ids);

    @Query("SELECT oc.id FROM OrganizationCode oc WHERE oc.companyId = :companyId")
    List<Long> findAllIdsByCompanyId(@Param("companyId") Long companyId);
}
