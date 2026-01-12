package com.daou.allapps.dto.module;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 모듈 업로드 응답 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ModuleUploadResponseDto {

    /**
     * 업로드 성공 여부
     */
    private boolean success;

    /**
     * 메시지
     */
    private String message;

    /**
     * 업로드된 모듈 정보 (성공 시)
     */
    private ModuleInfo module;

    /**
     * 검증 결과
     */
    private ValidationResult validation;

    /**
     * 모듈 정보 내부 클래스
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ModuleInfo {
        private String moduleUUID;
        private String packageUUID;
        private String moduleName;
        private String packageName;
        private String version;
        private ModuleMeta meta;
        private Instant createdAt;
        private Instant updatedAt;
    }

    /**
     * 모듈 메타데이터 내부 클래스
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ModuleMeta {
        private String icon;
        private String color;
        private String description;
        private List<String> tags;
    }

    /**
     * 업로드 성공 응답 생성
     */
    public static ModuleUploadResponseDto success(ModuleInfo module, ValidationResult validation) {
        return ModuleUploadResponseDto.builder()
                .success(true)
                .message("Module uploaded successfully")
                .module(module)
                .validation(validation)
                .build();
    }

    /**
     * 업로드 실패 응답 생성
     */
    public static ModuleUploadResponseDto failure(String message, ValidationResult validation) {
        return ModuleUploadResponseDto.builder()
                .success(false)
                .message(message)
                .validation(validation)
                .build();
    }

    /**
     * 검증 실패 응답 생성
     */
    public static ModuleUploadResponseDto validationFailed(ValidationResult validation) {
        return ModuleUploadResponseDto.builder()
                .success(false)
                .message("Validation failed")
                .validation(validation)
                .build();
    }
}
