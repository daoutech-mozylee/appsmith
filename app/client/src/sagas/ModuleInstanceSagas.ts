import { takeLatest, call, put } from "redux-saga/effects";
import ModuleApi from "api/ModuleApi";
import { validateResponse } from "sagas/ErrorSagas";
import {
  fetchModuleInstancesError,
  fetchModuleInstancesSuccess,
  type FetchModuleInstancesPayload,
} from "actions/moduleInstanceActions";
import type { ReduxAction } from "actions/ReduxActionTypes";
import { ReduxActionTypes } from "ee/constants/ReduxActionConstants";

function* fetchModuleInstancesSaga(
  action: ReduxAction<FetchModuleInstancesPayload>,
) {
  const { pageId } = action.payload;

  try {
    const response = yield call(
      ModuleApi.fetchModuleInstancesForContext,
      "PAGE",
      pageId,
    );
    const isValid: boolean = yield validateResponse(response);

    if (isValid) {
      yield put(fetchModuleInstancesSuccess(pageId, response.data));
    } else {
      yield put(fetchModuleInstancesError(pageId));
    }
  } catch (error) {
    yield put(fetchModuleInstancesError(pageId));
  }
}

export default function* moduleInstanceSagas() {
  yield takeLatest(
    ReduxActionTypes.FETCH_MODULE_INSTANCES_INIT,
    fetchModuleInstancesSaga,
  );
}
