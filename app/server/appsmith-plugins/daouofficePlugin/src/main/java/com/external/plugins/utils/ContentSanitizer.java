package com.external.plugins.utils;

import org.springframework.util.StringUtils;

public final class ContentSanitizer {

    private ContentSanitizer() {
        // Utility class - prevent instantiation
    }

    /**
     * HTML 콘텐츠 내 Base64 이미지 데이터를 정제합니다.
     * 공백 문자를 제거하여 올바른 Base64 형식으로 변환합니다.
     *
     * @param content HTML 콘텐츠
     * @return 정제된 HTML 콘텐츠
     */
    public static String sanitizeHtmlContent(String content) {
        if (!StringUtils.hasText(content)) {
            return content;
        }

        StringBuilder sb = new StringBuilder(content);
        String target = "base64,";
        int idx = sb.indexOf(target);

        while (idx != -1) {
            int startBase64 = idx + target.length();
            // Find end quote
            int endQuote = sb.indexOf("\"", startBase64);
            if (endQuote == -1) {
                endQuote = sb.indexOf("'", startBase64);
            }

            if (endQuote != -1) {
                String oddBase64 = sb.substring(startBase64, endQuote);
                String fixedBase64 = sanitizeBase64Payload(oddBase64);
                if (!fixedBase64.equals(oddBase64)) {
                    sb.replace(startBase64, endQuote, fixedBase64);
                    endQuote = startBase64 + fixedBase64.length();
                }
                idx = sb.indexOf(target, endQuote);
            } else {
                break;
            }
        }
        return sb.toString();
    }

    /**
     * Base64 문자열에서 공백 문자를 제거합니다.
     *
     * @param base64 Base64 인코딩된 문자열
     * @return 공백이 제거된 Base64 문자열
     */
    public static String sanitizeBase64Payload(String base64) {
        StringBuilder cleaned = new StringBuilder(base64.length());
        for (int i = 0; i < base64.length(); i++) {
            char ch = base64.charAt(i);
            if (!Character.isWhitespace(ch)) {
                cleaned.append(ch);
            }
        }
        return cleaned.toString();
    }
}
