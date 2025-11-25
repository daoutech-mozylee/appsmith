package com.daou.dop.allapps.doserver.provision.organization.utils;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

public class SupportUtils {

    /**
     * DTO 리스트에서 ID를 추출하여 DB에 존재하는지 확인하는 Map을 생성합니다.
     * @param dtos DTO 리스트
     * @param idExtractor DTO에서 ID를 추출하는 Function
     * @param dbFinder DB에서 존재하는 ID를 조회하는 Function
     * @return ID -> 존재여부(Boolean) Map
     */
    public static <D> Map<Long, Boolean> loadExistingIdMap(List<D> dtos, Function<D, Long> idExtractor,
                                                            Function<List<Long>, List<Long>> dbFinder) {
        List<Long> ids = dtos.stream()
            .map(idExtractor)
            .filter(Objects::nonNull)
            .toList();

        if (ids.isEmpty()) {
            return Collections.emptyMap();
        }

        // DB에서 실제 존재하는 id 조회
        Set<Long> existingIds = new HashSet<>(dbFinder.apply(ids));
        return ids.stream().collect(Collectors.toMap(Function.identity(), existingIds::contains));
    }
}
