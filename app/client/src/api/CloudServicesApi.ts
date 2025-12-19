import { API_PREFIX } from "ee/constants/ApiConstants";

export const authorizeDatasourceWithAppsmithToken = (appsmithToken: string) =>
  `${API_PREFIX}/api/v1/saas/authorize?appsmithToken=${appsmithToken}`;
