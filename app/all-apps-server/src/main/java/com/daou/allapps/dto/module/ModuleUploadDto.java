package com.daou.allapps.dto.module;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 모듈 업로드 요청 DTO
 *
 * multipart/form-data 형식으로 전송됩니다.
 * - file: JSON 파일 (MultipartFile)
 * - version: 버전 (선택)
 * - changeLog: 변경 이력 (선택)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ModuleUploadDto {

    /**
     * 버전 (선택)
     * 지정하지 않으면 기존 버전 +1 또는 1.0.0
     */
    private String version;

    /**
     * 변경 이력 (선택)
     */
    private String changeLog;
}
