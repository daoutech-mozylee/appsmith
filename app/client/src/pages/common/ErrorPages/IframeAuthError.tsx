import React, { useEffect } from "react";
import {
  createMessage,
  IFRAME_AUTH_ERROR_TITLE,
  IFRAME_AUTH_ERROR_DESCRIPTION,
} from "ee/constants/messages";
import AnalyticsUtil from "ee/utils/AnalyticsUtil";

import Page from "./Page";

function IframeAuthError() {
  useEffect(() => {
    AnalyticsUtil.logEvent("IFRAME_AUTH_ERROR");
  }, []);

  return (
    <Page
      description={createMessage(IFRAME_AUTH_ERROR_DESCRIPTION)}
      title={createMessage(IFRAME_AUTH_ERROR_TITLE)}
    />
  );
}

export default IframeAuthError;
