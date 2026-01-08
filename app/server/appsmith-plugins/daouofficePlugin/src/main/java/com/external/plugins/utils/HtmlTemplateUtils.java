package com.external.plugins.utils;

public final class HtmlTemplateUtils {

    private HtmlTemplateUtils() {
        // Utility class - prevent instantiation
    }

    /**
     * 리드 등록 알림 HTML 템플릿을 반환합니다.
     *
     * @return 리드 등록 알림 HTML
     */
    public static String getLeadRegistrationTemplate() {
        return """
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;'>
              <div style='background-color: #4A90E2; padding: 20px; text-align: center; color: white;'>
                <h1 style='margin: 0; font-size: 24px;'>리드 등록 알림</h1>
              </div>
              <div style='padding: 30px; background-color: #ffffff;'>
                <p style='font-size: 16px; color: #333;'>안녕하세요,</p>
                <p style='font-size: 16px; color: #333;'>새로운 리드가 등록되었습니다. <br>자세한 내용은 리드 관리 시스템에서 확인해 주세요.</p>
                <div style='margin-top: 30px; text-align: center;'>
                  <a href='#' style='display: inline-block; padding: 12px 24px; background-color: #4A90E2; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;'>등록된 리드 확인하기</a>
                </div>
              </div>
              <div style='background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888;'>
                © 2024 DaouOffice Lead Management
              </div>
            </div>
            """;
    }

    /**
     * 리드 배정 알림 HTML 템플릿을 반환합니다.
     *
     * @return 리드 배정 알림 HTML
     */
    public static String getLeadAssignmentTemplate() {
        return """
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;'>
              <div style='background-color: #4A90E2; padding: 20px; text-align: center; color: white;'>
                <h1 style='margin: 0; font-size: 24px;'>리드 배정 알림</h1>
              </div>
              <div style='padding: 30px; background-color: #ffffff;'>
                <p style='font-size: 16px; color: #333;'>안녕하세요,</p>
                <p style='font-size: 16px; color: #333;'>새로운 리드의 담당자로 배정되었습니다. <br>자세한 내용은 리드 관리 시스템에서 확인해 주세요.</p>
                <div style='margin-top: 30px; text-align: center;'>
                  <a href='#' style='display: inline-block; padding: 12px 24px; background-color: #4A90E2; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;'>리드 확인하기</a>
                </div>
              </div>
              <div style='background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888;'>
                © 2024 DaouOffice Lead Management
              </div>
            </div>
            """;
    }

    /**
     * 리드 상태 변경 알림 HTML 템플릿을 반환합니다.
     *
     * @return 리드 상태 변경 알림 HTML
     */
    public static String getLeadStatusUpdateTemplate() {
        return """
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;'>
              <div style='background-color: #4A90E2; padding: 20px; text-align: center; color: white;'>
                <h1 style='margin: 0; font-size: 24px;'>리드 상태 변경 알림</h1>
              </div>
              <div style='padding: 30px; background-color: #ffffff;'>
                <p style='font-size: 16px; color: #333;'>안녕하세요,</p>
                <p style='font-size: 16px; color: #333;'>리드 상태가 변경되었습니다. <br>자세한 내용은 리드 관리 시스템에서 확인해 주세요.</p>
                <div style='margin-top: 30px; text-align: center;'>
                  <a href='#' style='display: inline-block; padding: 12px 24px; background-color: #4A90E2; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;'>리드 확인하기</a>
                </div>
              </div>
              <div style='background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #888;'>
                © 2024 DaouOffice Lead Management
              </div>
            </div>
            """;
    }
}
