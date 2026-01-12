package com.daou.allapps.dto.module;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * 모듈 스키마 검증 결과 DTO
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ValidationResult {

    /**
     * 검증 성공 여부
     */
    private boolean valid;

    /**
     * 에러 메시지 목록 (검증 실패 시)
     */
    @Builder.Default
    private List<String> errors = new ArrayList<>();

    /**
     * 경고 메시지 목록 (선택적 필드 누락 등)
     */
    @Builder.Default
    private List<String> warnings = new ArrayList<>();

    /**
     * 검증 성공 결과 생성
     */
    public static ValidationResult success() {
        return ValidationResult.builder()
                .valid(true)
                .build();
    }

    /**
     * 검증 성공 결과 생성 (경고 포함)
     */
    public static ValidationResult successWithWarnings(List<String> warnings) {
        return ValidationResult.builder()
                .valid(true)
                .warnings(warnings)
                .build();
    }

    /**
     * 검증 실패 결과 생성
     */
    public static ValidationResult failure(List<String> errors) {
        return ValidationResult.builder()
                .valid(false)
                .errors(errors)
                .build();
    }

    /**
     * 검증 실패 결과 생성 (경고 포함)
     */
    public static ValidationResult failure(List<String> errors, List<String> warnings) {
        return ValidationResult.builder()
                .valid(false)
                .errors(errors)
                .warnings(warnings)
                .build();
    }
}
