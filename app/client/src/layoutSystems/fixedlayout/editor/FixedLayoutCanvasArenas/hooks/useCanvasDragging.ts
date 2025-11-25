import type { OccupiedSpace } from "constants/CanvasEditorConstants";
import {
  BUILDING_BLOCK_EXPLORER_TYPE,
  GridDefaults,
  MAIN_CONTAINER_WIDGET_ID,
} from "constants/WidgetConstants";
import { debounce, isEmpty, throttle } from "lodash";
import type React from "react";
import { useEffect, useMemo, useRef } from "react";
import type {
  MovementLimitMap,
  ReflowedSpaceMap,
  SpaceMap,
} from "reflow/reflowTypes";
import { ReflowDirection } from "reflow/reflowTypes";
import { getNearestParentCanvas } from "utils/generators";
import { useWidgetDragResize } from "utils/hooks/dragResizeHooks";
import type { ReflowInterface } from "utils/hooks/useReflow";
import { useReflow } from "utils/hooks/useReflow";
import {
  getDraggingSpacesFromBlocks,
  getMousePositionsOnCanvas,
  noCollision,
} from "utils/WidgetPropsUtils";
import {
  getEdgeDirection,
  getMoveDirection,
  getReflowedSpaces,
  modifyBlockDimension,
  modifyDrawingRectangles,
  updateRectanglesPostReflow,
} from "layoutSystems/common/utils/canvasDraggingUtils";
import type {
  AlignmentGuide,
  WidgetDraggingBlock,
} from "../../../../common/canvasArenas/ArenaTypes";
import { useBlocksToBeDraggedOnCanvas } from "./useBlocksToBeDraggedOnCanvas";
import { useRenderBlocksOnCanvas } from "./useRenderBlocksOnCanvas";
import { useCanvasDragToScroll } from "layoutSystems/common/canvasArenas/useCanvasDragToScroll";
import type { FixedCanvasDraggingArenaProps } from "../FixedCanvasDraggingArena";
import { useSelector } from "react-redux";
import { getDragDetails } from "sagas/selectors";

const ALIGNMENT_TOLERANCE_PX = 4;
const SPACING_TOLERANCE_PX = 4;
const SNAP_EPSILON = 0.5;

type PixelRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

const getBoundingRect = (blocks: WidgetDraggingBlock[]): PixelRect | null => {
  if (!blocks.length) {
    return null;
  }

  let left = blocks[0].left;
  let top = blocks[0].top;
  let right = blocks[0].left + blocks[0].width;
  let bottom = blocks[0].top + blocks[0].height;

  blocks.forEach((block) => {
    left = Math.min(left, block.left);
    top = Math.min(top, block.top);
    right = Math.max(right, block.left + block.width);
    bottom = Math.max(bottom, block.top + block.height);
  });

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
};

const addGuide = (
  guides: AlignmentGuide[],
  guideSet: Set<string>,
  guide: AlignmentGuide,
) => {
  const key = `${guide.orientation}:${Math.round(guide.start.x)}:${Math.round(
    guide.start.y,
  )}:${Math.round(guide.end.x)}:${Math.round(guide.end.y)}:${guide.kind}`;

  if (!guideSet.has(key)) {
    guideSet.add(key);
    guides.push(guide);
  }
};

const toPixelSpace = (
  space: OccupiedSpace,
  snapColumnSpace: number,
  snapRowSpace: number,
  spacePositionMap?: SpaceMap,
): PixelRect => {
  const override = spacePositionMap?.[space.id];
  const left = (override?.left ?? space.left) * snapColumnSpace;
  const right = (override?.right ?? space.right) * snapColumnSpace;
  const top = (override?.top ?? space.top) * snapRowSpace;
  const bottom = (override?.bottom ?? space.bottom) * snapRowSpace;

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
};

const getAlignmentGuides = (
  rectanglesToDraw: WidgetDraggingBlock[],
  occupiedSpaces: OccupiedSpace[],
  snapColumnSpace: number,
  snapRowSpace: number,
  parentWidth: number,
  parentHeight: number,
  spacePositionMap?: SpaceMap,
): AlignmentGuide[] => {
  const guides: AlignmentGuide[] = [];
  const guideSet = new Set<string>();
  const boundingRect = getBoundingRect(rectanglesToDraw);

  if (!boundingRect) {
    return guides;
  }

  const centerX = boundingRect.left + boundingRect.width / 2;
  const centerY = boundingRect.top + boundingRect.height / 2;
  const dragLeft = boundingRect.left;
  const dragRight = boundingRect.right;
  const dragTop = boundingRect.top;
  const dragBottom = boundingRect.bottom;
  const pixelSpaces = occupiedSpaces.map((space) =>
    toPixelSpace(space, snapColumnSpace, snapRowSpace, spacePositionMap),
  );

  let centerVerticalBounds = {
    min: boundingRect.top,
    max: boundingRect.bottom,
  };
  let centerHorizontalBounds = {
    min: boundingRect.left,
    max: boundingRect.right,
  };
  let hasVerticalCenterGuide = false;
  let hasHorizontalCenterGuide = false;
  let closestCenterDeltaX: number | null = null;
  let closestCenterDeltaY: number | null = null;

  pixelSpaces.forEach((rect) => {
    const otherCenterX = rect.left + rect.width / 2;
    const otherCenterY = rect.top + rect.height / 2;

    const minX = Math.min(rect.left, dragLeft);
    const maxX = Math.max(rect.right, dragRight);
    const minY = Math.min(rect.top, dragTop);
    const maxY = Math.max(rect.bottom, dragBottom);

    if (Math.abs(dragTop - rect.top) <= ALIGNMENT_TOLERANCE_PX) {
      const deltaY = rect.top - dragTop;
      addGuide(guides, guideSet, {
        orientation: "horizontal",
        start: { x: minX, y: rect.top },
        end: { x: maxX, y: rect.top },
        kind: "edge",
        snap: { deltaY },
      });
    }

    if (Math.abs(dragBottom - rect.bottom) <= ALIGNMENT_TOLERANCE_PX) {
      const deltaY = rect.bottom - dragBottom;
      addGuide(guides, guideSet, {
        orientation: "horizontal",
        start: { x: minX, y: rect.bottom },
        end: { x: maxX, y: rect.bottom },
        kind: "edge",
        snap: { deltaY },
      });
    }

    if (Math.abs(dragLeft - rect.left) <= ALIGNMENT_TOLERANCE_PX) {
      const deltaX = rect.left - dragLeft;
      addGuide(guides, guideSet, {
        orientation: "vertical",
        start: { x: rect.left, y: minY },
        end: { x: rect.left, y: maxY },
        kind: "edge",
        snap: { deltaX },
      });
    }

    if (Math.abs(dragRight - rect.right) <= ALIGNMENT_TOLERANCE_PX) {
      const deltaX = rect.right - dragRight;
      addGuide(guides, guideSet, {
        orientation: "vertical",
        start: { x: rect.right, y: minY },
        end: { x: rect.right, y: maxY },
        kind: "edge",
        snap: { deltaX },
      });
    }

    if (Math.abs(centerX - otherCenterX) <= ALIGNMENT_TOLERANCE_PX) {
      const delta = otherCenterX - centerX;
      if (
        closestCenterDeltaX === null ||
        Math.abs(delta) < Math.abs(closestCenterDeltaX)
      ) {
        closestCenterDeltaX = delta;
      }
      hasVerticalCenterGuide = true;
      centerVerticalBounds = {
        min: Math.min(centerVerticalBounds.min, rect.top),
        max: Math.max(centerVerticalBounds.max, rect.bottom),
      };
    }

    if (Math.abs(centerY - otherCenterY) <= ALIGNMENT_TOLERANCE_PX) {
      const delta = otherCenterY - centerY;
      if (
        closestCenterDeltaY === null ||
        Math.abs(delta) < Math.abs(closestCenterDeltaY)
      ) {
        closestCenterDeltaY = delta;
      }
      hasHorizontalCenterGuide = true;
      centerHorizontalBounds = {
        min: Math.min(centerHorizontalBounds.min, rect.left),
        max: Math.max(centerHorizontalBounds.max, rect.right),
      };
    }
  });

  if (hasVerticalCenterGuide) {
    const deltaX = closestCenterDeltaX ?? 0;
    addGuide(guides, guideSet, {
      orientation: "vertical",
      start: { x: centerX, y: centerVerticalBounds.min },
      end: { x: centerX, y: centerVerticalBounds.max },
      kind: "center",
      snap: { deltaX },
    });
  }

  if (hasHorizontalCenterGuide) {
    const deltaY = closestCenterDeltaY ?? 0;
    addGuide(guides, guideSet, {
      orientation: "horizontal",
      start: { x: centerHorizontalBounds.min, y: centerY },
      end: { x: centerHorizontalBounds.max, y: centerY },
      kind: "center",
      snap: { deltaY },
    });
  }

  if (parentWidth > 0) {
    const parentCenterX = parentWidth / 2;
    if (Math.abs(centerX - parentCenterX) <= ALIGNMENT_TOLERANCE_PX) {
      const deltaX = parentCenterX - centerX;
      addGuide(guides, guideSet, {
        orientation: "vertical",
        start: { x: parentCenterX, y: 0 },
        end: { x: parentCenterX, y: Math.max(parentHeight, dragBottom) },
        kind: "center",
        snap: { deltaX },
      });
    }
  }

  if (parentHeight > 0) {
    const parentCenterY = parentHeight / 2;
    if (Math.abs(centerY - parentCenterY) <= ALIGNMENT_TOLERANCE_PX) {
      const deltaY = parentCenterY - centerY;
      addGuide(guides, guideSet, {
        orientation: "horizontal",
        start: { x: 0, y: parentCenterY },
        end: { x: Math.max(parentWidth, dragRight), y: parentCenterY },
        kind: "center",
        snap: { deltaY },
      });
    }
  }

  const horizontalSpacingGuides = getEqualSpacingGuides(
    pixelSpaces,
    boundingRect,
    "horizontal",
  );
  const verticalSpacingGuides = getEqualSpacingGuides(
    pixelSpaces,
    boundingRect,
    "vertical",
  );

  horizontalSpacingGuides.forEach((guide) => addGuide(guides, guideSet, guide));
  verticalSpacingGuides.forEach((guide) => addGuide(guides, guideSet, guide));

  return guides;
};

const getOverlapMidpoint = (
  startA: number,
  endA: number,
  startB: number,
  endB: number,
) => {
  const start = Math.max(startA, startB);
  const end = Math.min(endA, endB);

  if (start <= end) {
    return start + (end - start) / 2;
  }

  return (startA + endA + startB + endB) / 4;
};

const getEqualSpacingGuides = (
  pixelSpaces: PixelRect[],
  movingRect: PixelRect,
  axis: "horizontal" | "vertical",
): AlignmentGuide[] => {
  const guides: AlignmentGuide[] = [];

  if (!pixelSpaces.length) {
    return guides;
  }

  if (axis === "horizontal") {
    const sameRow = pixelSpaces.filter(
      (rect) =>
        !(rect.bottom <= movingRect.top || rect.top >= movingRect.bottom),
    );

    if (!sameRow.length) {
      return guides;
    }

    const combined = [...sameRow, movingRect].sort(
      (a, b) => a.left - b.left || a.top - b.top,
    );
    const movingIndex = combined.findIndex((rect) => rect === movingRect);

    const addHorizontalGuide = (
      startX: number,
      endX: number,
      rectA: PixelRect,
      rectB: PixelRect,
      deltaX: number,
    ) => {
      if (startX === endX) return;
      const y = getOverlapMidpoint(
        rectA.top,
        rectA.bottom,
        rectB.top,
        rectB.bottom,
      );
      guides.push({
        orientation: "horizontal",
        start: { x: startX, y },
        end: { x: endX, y },
        kind: "spacing",
        snap: { deltaX },
      });
    };

    if (movingIndex > 0 && movingIndex < combined.length - 1) {
      const leftNeighbor = combined[movingIndex - 1];
      const rightNeighbor = combined[movingIndex + 1];
      const targetLeft =
        (leftNeighbor.right + rightNeighbor.left - movingRect.width) / 2;
      const delta = targetLeft - movingRect.left;
      const gapLeft = movingRect.left - leftNeighbor.right;
      const gapRight = rightNeighbor.left - movingRect.right;
      if (
        gapLeft >= 0 &&
        gapRight >= 0 &&
        Math.abs(gapLeft - gapRight) <= SPACING_TOLERANCE_PX
      ) {
        addHorizontalGuide(
          leftNeighbor.right,
          movingRect.left,
          leftNeighbor,
          movingRect,
          delta,
        );
        addHorizontalGuide(
          movingRect.right,
          rightNeighbor.left,
          movingRect,
          rightNeighbor,
          delta,
        );
      }
    }

    if (movingIndex > 1) {
      const leftNeighbor = combined[movingIndex - 1];
      const secondLeft = combined[movingIndex - 2];
      const gapCurrent = movingRect.left - leftNeighbor.right;
      const gapReference = leftNeighbor.left - secondLeft.right;
      if (
        gapCurrent >= 0 &&
        gapReference >= 0 &&
        Math.abs(gapCurrent - gapReference) <= SPACING_TOLERANCE_PX
      ) {
        const targetLeft = leftNeighbor.right + gapReference;
        const delta = targetLeft - movingRect.left;
        addHorizontalGuide(
          leftNeighbor.right,
          movingRect.left,
          leftNeighbor,
          movingRect,
          delta,
        );
      }
    }

    if (combined.length - movingIndex > 2) {
      const rightNeighbor = combined[movingIndex + 1];
      const secondRight = combined[movingIndex + 2];
      const gapCurrent = rightNeighbor.left - movingRect.right;
      const gapReference = secondRight.left - rightNeighbor.right;
      if (
        gapCurrent >= 0 &&
        gapReference >= 0 &&
        Math.abs(gapCurrent - gapReference) <= SPACING_TOLERANCE_PX
      ) {
        const targetLeft = rightNeighbor.left - gapReference - movingRect.width;
        const delta = targetLeft - movingRect.left;
        addHorizontalGuide(
          movingRect.right,
          rightNeighbor.left,
          movingRect,
          rightNeighbor,
          delta,
        );
      }
    }
  } else {
    const sameColumn = pixelSpaces.filter(
      (rect) =>
        !(rect.right <= movingRect.left || rect.left >= movingRect.right),
    );

    if (!sameColumn.length) {
      return guides;
    }

    const combined = [...sameColumn, movingRect].sort(
      (a, b) => a.top - b.top || a.left - b.left,
    );
    const movingIndex = combined.findIndex((rect) => rect === movingRect);

    const addVerticalGuide = (
      startY: number,
      endY: number,
      rectA: PixelRect,
      rectB: PixelRect,
      deltaY: number,
    ) => {
      if (startY === endY) return;
      const x = getOverlapMidpoint(
        rectA.left,
        rectA.right,
        rectB.left,
        rectB.right,
      );
      guides.push({
        orientation: "vertical",
        start: { x, y: startY },
        end: { x, y: endY },
        kind: "spacing",
        snap: { deltaY },
      });
    };

    if (movingIndex > 0 && movingIndex < combined.length - 1) {
      const topNeighbor = combined[movingIndex - 1];
      const bottomNeighbor = combined[movingIndex + 1];
      const targetTop =
        (topNeighbor.bottom + bottomNeighbor.top - movingRect.height) / 2;
      const delta = targetTop - movingRect.top;
      const gapTop = movingRect.top - topNeighbor.bottom;
      const gapBottom = bottomNeighbor.top - movingRect.bottom;
      if (
        gapTop >= 0 &&
        gapBottom >= 0 &&
        Math.abs(gapTop - gapBottom) <= SPACING_TOLERANCE_PX
      ) {
        addVerticalGuide(
          topNeighbor.bottom,
          movingRect.top,
          topNeighbor,
          movingRect,
          delta,
        );
        addVerticalGuide(
          movingRect.bottom,
          bottomNeighbor.top,
          movingRect,
          bottomNeighbor,
          delta,
        );
      }
    }

    if (movingIndex > 1) {
      const topNeighbor = combined[movingIndex - 1];
      const secondTop = combined[movingIndex - 2];
      const gapCurrent = movingRect.top - topNeighbor.bottom;
      const gapReference = topNeighbor.top - secondTop.bottom;
      if (
        gapCurrent >= 0 &&
        gapReference >= 0 &&
        Math.abs(gapCurrent - gapReference) <= SPACING_TOLERANCE_PX
      ) {
        const targetTop = topNeighbor.bottom + gapReference;
        const delta = targetTop - movingRect.top;
        addVerticalGuide(
          topNeighbor.bottom,
          movingRect.top,
          topNeighbor,
          movingRect,
          delta,
        );
      }
    }

    if (combined.length - movingIndex > 2) {
      const bottomNeighbor = combined[movingIndex + 1];
      const secondBottom = combined[movingIndex + 2];
      const gapCurrent = bottomNeighbor.top - movingRect.bottom;
      const gapReference = secondBottom.top - bottomNeighbor.bottom;
      if (
        gapCurrent >= 0 &&
        gapReference >= 0 &&
        Math.abs(gapCurrent - gapReference) <= SPACING_TOLERANCE_PX
      ) {
        const targetTop = bottomNeighbor.top - gapReference - movingRect.height;
        const delta = targetTop - movingRect.top;
        addVerticalGuide(
          movingRect.bottom,
          bottomNeighbor.top,
          movingRect,
          bottomNeighbor,
          delta,
        );
      }
    }
  }

  return guides;
};

type SnapDelta = {
  deltaX: number;
  deltaY: number;
};

const getSnapDeltaFromGuides = (guides: AlignmentGuide[]): SnapDelta => {
  let deltaX: number | null = null;
  let deltaY: number | null = null;

  guides.forEach((guide) => {
    const { snap } = guide;
    if (!snap) {
      return;
    }

    if (snap.deltaX !== undefined) {
      if (deltaX === null || Math.abs(snap.deltaX) < Math.abs(deltaX)) {
        deltaX = snap.deltaX;
      }
    }

    if (snap.deltaY !== undefined) {
      if (deltaY === null || Math.abs(snap.deltaY) < Math.abs(deltaY)) {
        deltaY = snap.deltaY;
      }
    }
  });

  const result: SnapDelta = {
    deltaX: deltaX ?? 0,
    deltaY: deltaY ?? 0,
  };

  if (Math.abs(result.deltaX) < SNAP_EPSILON) {
    result.deltaX = 0;
  }
  if (Math.abs(result.deltaY) < SNAP_EPSILON) {
    result.deltaY = 0;
  }

  return result;
};

const applyAlignmentSnap = (
  rectangles: WidgetDraggingBlock[],
  snapDelta: SnapDelta,
): WidgetDraggingBlock[] => {
  const { deltaX, deltaY } = snapDelta;
  if (deltaX === 0 && deltaY === 0) {
    return rectangles;
  }

  return rectangles.map((block) => ({
    ...block,
    left: block.left + deltaX,
    top: block.top + deltaY,
  }));
};

const applySnapToReflowSpaces = (
  spaces: OccupiedSpace[],
  snapDelta: SnapDelta,
  snapColumnSpace: number,
  snapRowSpace: number,
): OccupiedSpace[] => {
  const { deltaX, deltaY } = snapDelta;
  if (spaces.length === 0 || (deltaX === 0 && deltaY === 0)) {
    return spaces;
  }

  const deltaCols = deltaX / snapColumnSpace;
  const deltaRows = deltaY / snapRowSpace;

  if (deltaCols === 0 && deltaRows === 0) {
    return spaces;
  }

  return spaces.map((space) => ({
    ...space,
    left: space.left + deltaCols,
    right: space.right + deltaCols,
    top: space.top + deltaRows,
    bottom: space.bottom + deltaRows,
  }));
};

/**
 * useCanvasDragging hook is utilized to handle all drag and drop related functions that are required to give user the sense of dragging and dropping while moving a widget on canvas
 * @param slidingArenaRef
 * @param stickyCanvasRef
 * @param object that contains,
 * @prop canExtend, indicates if the canvas can extend
 * @props dropDisabled indicates if dropping wi is enabled on the canvas
 * @prop noPad, indicates if the widget canvas has padding
 * @prop snapColumnSpace, width between two columns grid
 * @prop snapRows, number of rows in the canvas
 * @prop snapRowSpace, height between two row grid
 * @prop widgetId, id of the current widget canvas associated with current AutoCanvasDraggingArena
 * @returns showCanvas to indicate if the html canvas side should be rendered
 */
export const useCanvasDragging = (
  slidingArenaRef: React.RefObject<HTMLDivElement>,
  stickyCanvasRef: React.RefObject<HTMLCanvasElement>,
  {
    canExtend,
    dropDisabled,
    noPad,
    snapColumnSpace,
    snapRows,
    snapRowSpace,
    widgetId,
  }: FixedCanvasDraggingArenaProps,
) => {
  const currentDirection = useRef<ReflowDirection>(ReflowDirection.UNSET);
  const dragDetails = useSelector(getDragDetails);
  const { devicePixelRatio: scale = 1 } = window;
  const {
    blocksToDraw,
    defaultHandlePositions,
    draggingSpaces,
    getSnappedXY,
    isChildOfCanvas,
    isCurrentDraggedCanvas,
    isDragging,
    isNewWidget,
    isNewWidgetInitialTargetCanvas,
    isResizing,
    lastDraggedCanvas,
    occSpaces,
    onDrop,
    parentDiff,
    relativeStartPoints,
    rowRef,
    stopReflowing,
    updateBottomRow,
    updateRelativeRows,
  } = useBlocksToBeDraggedOnCanvas({
    canExtend,
    noPad,
    snapColumnSpace,
    snapRows,
    snapRowSpace,
    widgetId,
  });
  const gridProps = {
    parentColumnSpace: snapColumnSpace,
    parentRowSpace: snapRowSpace,
    maxGridColumns: GridDefaults.DEFAULT_GRID_COLUMNS,
    paddingOffset: 0,
  };

  const reflow = useRef<{
    reflowSpaces: ReflowInterface;
    resetReflow: () => void;
  }>();
  const alignmentGuidesRef = useRef<AlignmentGuide[]>([]);

  reflow.current = useReflow(draggingSpaces, widgetId || "", gridProps);

  const { setDraggingCanvas, setDraggingNewWidget, setDraggingState } =
    useWidgetDragResize();
  const canvasRenderingDependencies = useMemo(
    () => ({
      snapRows,
      canExtend,
    }),
    [snapRows, canExtend],
  );
  const canScroll = useCanvasDragToScroll(
    slidingArenaRef,
    isCurrentDraggedCanvas,
    isDragging,
    canvasRenderingDependencies,
  );

  const renderBlocks = useRenderBlocksOnCanvas(
    slidingArenaRef,
    stickyCanvasRef,
    !!noPad,
    snapColumnSpace,
    snapRowSpace,
    getSnappedXY,
    isCurrentDraggedCanvas,
  );

  useEffect(() => {
    const inModuleEditor = window.location.pathname.includes("/modules/");

    if (
      slidingArenaRef.current &&
      !isResizing &&
      isDragging &&
      (blocksToDraw.length > 0 || inModuleEditor)
    ) {
      // doing throttling coz reflow moves are also throttled and resetCanvas can be called multiple times
      const throttledStopReflowing = throttle(stopReflowing, 50);
      const scrollParent: Element | null = getNearestParentCanvas(
        slidingArenaRef.current,
      );

      let canvasIsDragging = false;
      let isUpdatingRows = false;
      let currentRectanglesToDraw: WidgetDraggingBlock[] = [];
      // TODO: Fix this the next time the file is edited
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scrollObj: any = {};

      let currentReflowParams: {
        movementLimitMap?: MovementLimitMap;
        bottomMostRow: number;
        movementMap: ReflowedSpaceMap;
        spacePositionMap: SpaceMap | undefined;
      } = {
        movementLimitMap: {},
        bottomMostRow: 0,
        movementMap: {},
        spacePositionMap: {},
      };
      let lastSnappedPosition: OccupiedSpace = {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        id: "",
      };

      const resetCanvasState = () => {
        throttledStopReflowing();
        reflow.current?.resetReflow();

        if (stickyCanvasRef.current && slidingArenaRef.current) {
          // TODO: Fix this the next time the file is edited
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const canvasCtx: any = stickyCanvasRef.current.getContext("2d");

          canvasCtx.clearRect(
            0,
            0,
            stickyCanvasRef.current.width,
            stickyCanvasRef.current.height,
          );
          slidingArenaRef.current.style.zIndex = "";
          canvasIsDragging = false;
        }

        if (isDragging) {
          setDraggingCanvas(MAIN_CONTAINER_WIDGET_ID);
        }
        alignmentGuidesRef.current = [];
      };

      if (isDragging) {
        const startPoints = defaultHandlePositions;
        /**
         * On mouse up, calculate the top, left, bottom and right positions for each of the reflowed widgets
         */
        const onMouseUp = (event: MouseEvent) => {
          if (isDragging && canvasIsDragging) {
            const { movementMap: reflowingWidgets } = currentReflowParams;
            const reflowedPositionsUpdatesWidgets: OccupiedSpace[] = occSpaces
              .filter((each) => !!reflowingWidgets[each.id])
              .map((each) =>
                getReflowedSpaces(
                  each,
                  reflowingWidgets,
                  snapColumnSpace,
                  snapRowSpace,
                ),
              );

            const shouldSnap = event.shiftKey;
            const snapDelta = shouldSnap
              ? getSnapDeltaFromGuides(alignmentGuidesRef.current)
              : { deltaX: 0, deltaY: 0 };
            const snappedRectangles = shouldSnap
              ? applyAlignmentSnap(currentRectanglesToDraw, snapDelta)
              : currentRectanglesToDraw;
            const snappedReflowSpaces = shouldSnap
              ? applySnapToReflowSpaces(
                  reflowedPositionsUpdatesWidgets,
                  snapDelta,
                  snapColumnSpace,
                  snapRowSpace,
                )
              : reflowedPositionsUpdatesWidgets;

            onDrop(
              modifyDrawingRectangles(
                snappedRectangles,
                currentReflowParams.spacePositionMap,
                snapColumnSpace,
                snapRowSpace,
              ),
              snappedReflowSpaces,
            );
          }

          startPoints.top = defaultHandlePositions.top;
          startPoints.left = defaultHandlePositions.left;
          resetCanvasState();

          resetDragging();
        };

        const resetDragging = () => {
          setTimeout(() => {
            if (isCurrentDraggedCanvas) {
              if (isNewWidget) {
                setDraggingNewWidget(false, undefined);
              } else {
                setDraggingState({
                  isDragging: false,
                });
              }

              setDraggingCanvas();
            }
          }, 0);
        };

        // TODO: Fix this the next time the file is edited
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const onFirstMoveOnCanvas = (e: any, over = false) => {
          if (
            !isResizing &&
            isDragging &&
            !canvasIsDragging &&
            slidingArenaRef.current
          ) {
            if (!isNewWidget) {
              startPoints.left =
                relativeStartPoints.left || defaultHandlePositions.left;
              startPoints.top =
                relativeStartPoints.top || defaultHandlePositions.top;
            }

            if (!isCurrentDraggedCanvas) {
              // we can just use canvasIsDragging but this is needed to render the relative DragLayerComponent
              setDraggingCanvas(widgetId);
            }

            canvasIsDragging = true;
            slidingArenaRef.current.style.zIndex = "2";

            onMouseMove(e, over);
          }
        };

        // TODO: Fix this the next time the file is edited
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const triggerReflow = (e: any, firstMove: boolean) => {
          const canReflow =
            currentRectanglesToDraw.length > 0 &&
            !currentRectanglesToDraw[0].detachFromLayout &&
            !dropDisabled;
          const isReflowing =
            !isEmpty(currentReflowParams.movementMap) ||
            (!isEmpty(currentReflowParams.movementLimitMap) &&
              currentRectanglesToDraw.length === 1);
          //The position array of dragging Widgets.
          const resizedPositions = getDraggingSpacesFromBlocks(
            currentRectanglesToDraw,
            snapColumnSpace,
            snapRowSpace,
          );
          const currentBlock = resizedPositions[0];
          const mousePosition = getMousePositionsOnCanvas(e, gridProps);
          const needsReflow = !(
            lastSnappedPosition.left === currentBlock.left &&
            lastSnappedPosition.top === currentBlock.top &&
            lastSnappedPosition.bottom === currentBlock.bottom &&
            lastSnappedPosition.right === currentBlock.right
          );

          if (canReflow && reflow.current) {
            if (needsReflow) {
              currentDirection.current = getMoveDirection(
                lastSnappedPosition,
                currentBlock,
                currentDirection.current,
              );

              if (firstMove) {
                currentDirection.current = getEdgeDirection(
                  e.offsetX,
                  e.offsetY,
                  slidingArenaRef.current?.clientWidth,
                  currentDirection.current,
                );
              }

              lastSnappedPosition = { ...currentBlock };
              let immediateExitContainer;

              if (lastDraggedCanvas.current) {
                immediateExitContainer = lastDraggedCanvas.current;
                lastDraggedCanvas.current = undefined;
              }

              currentReflowParams = reflow.current?.reflowSpaces(
                resizedPositions,
                currentDirection.current,
                false,
                true,
                firstMove,
                immediateExitContainer,
                mousePosition,
                reflowAfterTimeoutCallback,
              );
            }

            if (isReflowing) {
              updateParamsPostReflow();
            }
          }
        };

        //update blocks after reflow
        const updateParamsPostReflow = () => {
          const { movementLimitMap } = currentReflowParams;

          // update isColliding of each block based on movementLimitMap
          currentRectanglesToDraw = updateRectanglesPostReflow(
            movementLimitMap,
            currentRectanglesToDraw,
            snapColumnSpace,
            snapRowSpace,
            rowRef.current,
          );

          const widgetIdsToExclude = currentRectanglesToDraw.map(
            (a) => a.widgetId,
          );
          const newRows = updateBottomRow(
            currentReflowParams.bottomMostRow,
            rowRef.current,
            widgetIdsToExclude,
          );

          rowRef.current = newRows ? newRows : rowRef.current;
        };

        // TODO: Fix this the next time the file is edited
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const onMouseMove = (e: any, firstMove = false) => {
          if (isDragging && canvasIsDragging && slidingArenaRef.current) {
            const delta = {
              left: e.offsetX - startPoints.left - parentDiff.left,
              top: e.offsetY - startPoints.top - parentDiff.top,
            };

            const drawingBlocks = blocksToDraw.map((each) => {
              let buildingBlockRows;
              let buildingBlockColumns;

              if (each.type === BUILDING_BLOCK_EXPLORER_TYPE) {
                buildingBlockRows = dragDetails.newWidget.rows;
                buildingBlockColumns = dragDetails.newWidget.columns;
              }

              return modifyBlockDimension(
                {
                  ...each,
                  left: each.left + delta.left,
                  top: each.top + delta.top,
                },
                snapColumnSpace,
                snapRowSpace,
                rowRef.current - 1,
                canExtend,
                false,
                buildingBlockColumns,
                buildingBlockRows,
              );
            });
            const newRows = updateRelativeRows(drawingBlocks, rowRef.current);
            const rowDelta = newRows ? newRows - rowRef.current : 0;

            rowRef.current = newRows ? newRows : rowRef.current;
            currentRectanglesToDraw = drawingBlocks.map((each) => ({
              ...each,
              isNotColliding:
                !dropDisabled &&
                noCollision(
                  { x: each.left, y: each.top },
                  snapColumnSpace,
                  snapRowSpace,
                  { x: 0, y: 0 },
                  each.columnWidth,
                  each.rowHeight,
                  each.widgetId,
                  occSpaces,
                  rowRef.current,
                  GridDefaults.DEFAULT_GRID_COLUMNS,
                  each.detachFromLayout,
                ),
            }));

            if (rowDelta && slidingArenaRef.current) {
              isUpdatingRows = true;
              canScroll.current = false;
              renderNewRows(delta);
            } else if (!isUpdatingRows) {
              triggerReflow(e, firstMove);
            }

            const parentWidth =
              GridDefaults.DEFAULT_GRID_COLUMNS * snapColumnSpace;
            const parentHeight = rowRef.current * snapRowSpace;
            const alignmentGuides = getAlignmentGuides(
              currentRectanglesToDraw,
              occSpaces,
              snapColumnSpace,
              snapRowSpace,
              parentWidth,
              parentHeight,
              currentReflowParams.spacePositionMap,
            );
            alignmentGuidesRef.current = alignmentGuides;
            isUpdatingRows = renderBlocks(
              currentRectanglesToDraw,
              currentReflowParams.spacePositionMap,
              isUpdatingRows,
              canvasIsDragging,
              scrollParent,
              alignmentGuides,
            );
            scrollObj.lastMouseMoveEvent = {
              offsetX: e.offsetX,
              offsetY: e.offsetY,
            };
            scrollObj.lastScrollTop = scrollParent?.scrollTop;
            scrollObj.lastScrollHeight = scrollParent?.scrollHeight;
            scrollObj.lastDeltaLeft = delta.left;
            scrollObj.lastDeltaTop = delta.top;
          } else {
            onFirstMoveOnCanvas(e);
          }
        };
        const renderNewRows = debounce((delta) => {
          isUpdatingRows = true;

          if (slidingArenaRef.current && stickyCanvasRef.current) {
            // TODO: Fix this the next time the file is edited
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const canvasCtx: any = stickyCanvasRef.current.getContext("2d");

            currentRectanglesToDraw = blocksToDraw.map((each) => {
              const block = modifyBlockDimension(
                {
                  ...each,
                  left: each.left + delta.left,
                  top: each.top + delta.top,
                },
                snapColumnSpace,
                snapRowSpace,
                rowRef.current - 1,
                canExtend,
                false,
              );

              return {
                ...block,
                isNotColliding:
                  !dropDisabled &&
                  noCollision(
                    { x: block.left, y: block.top },
                    snapColumnSpace,
                    snapRowSpace,
                    { x: 0, y: 0 },
                    block.columnWidth,
                    block.rowHeight,
                    block.widgetId,
                    occSpaces,
                    rowRef.current,
                    GridDefaults.DEFAULT_GRID_COLUMNS,
                    block.detachFromLayout,
                  ),
              };
            });
            canvasCtx.save();
            canvasCtx.scale(scale, scale);
            canvasCtx.clearRect(
              0,
              0,
              stickyCanvasRef.current.width,
              stickyCanvasRef.current.height,
            );
            canvasCtx.restore();
            const parentWidth =
              GridDefaults.DEFAULT_GRID_COLUMNS * snapColumnSpace;
            const parentHeight = rowRef.current * snapRowSpace;
            const alignmentGuides = getAlignmentGuides(
              currentRectanglesToDraw,
              occSpaces,
              snapColumnSpace,
              snapRowSpace,
              parentWidth,
              parentHeight,
              currentReflowParams.spacePositionMap,
            );
            alignmentGuidesRef.current = alignmentGuides;
            isUpdatingRows = renderBlocks(
              currentRectanglesToDraw,
              currentReflowParams.spacePositionMap,
              isUpdatingRows,
              canvasIsDragging,
              scrollParent,
              alignmentGuides,
            );
            canScroll.current = false;
            endRenderRows.cancel();
            endRenderRows();
          }
        });

        const endRenderRows = throttle(
          () => {
            canScroll.current = true;
          },
          50,
          {
            leading: false,
            trailing: true,
          },
        );

        const reflowAfterTimeoutCallback = (reflowParams: {
          movementMap: ReflowedSpaceMap;
          spacePositionMap: SpaceMap | undefined;
          movementLimitMap: MovementLimitMap | undefined;
        }) => {
          currentReflowParams = { ...currentReflowParams, ...reflowParams };
          updateParamsPostReflow();
          const parentWidth =
            GridDefaults.DEFAULT_GRID_COLUMNS * snapColumnSpace;
          const parentHeight = rowRef.current * snapRowSpace;
          const alignmentGuides = getAlignmentGuides(
            currentRectanglesToDraw,
            occSpaces,
            snapColumnSpace,
            snapRowSpace,
            parentWidth,
            parentHeight,
            currentReflowParams.spacePositionMap,
          );
          alignmentGuidesRef.current = alignmentGuides;
          isUpdatingRows = renderBlocks(
            currentRectanglesToDraw,
            currentReflowParams.spacePositionMap,
            isUpdatingRows,
            canvasIsDragging,
            scrollParent,
            alignmentGuides,
          );
        };

        // Adding setTimeout to make sure this gets called after
        // the onscroll that resets intersectionObserver in StickyCanvasArena.tsx
        const onScroll = () =>
          setTimeout(() => {
            const { lastMouseMoveEvent, lastScrollHeight, lastScrollTop } =
              scrollObj;

            if (
              lastMouseMoveEvent &&
              typeof lastScrollHeight === "number" &&
              typeof lastScrollTop === "number" &&
              scrollParent &&
              canScroll.current
            ) {
              const delta =
                scrollParent?.scrollHeight +
                scrollParent?.scrollTop -
                (lastScrollHeight + lastScrollTop);

              onMouseMove({
                offsetX: lastMouseMoveEvent.offsetX,
                offsetY: lastMouseMoveEvent.offsetY + delta,
              });
            }
          }, 0);
        // TODO: Fix this the next time the file is edited
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const onMouseOver = (e: any) => {
          onFirstMoveOnCanvas(e, true);
        };

        //Initialize Listeners
        const initializeListeners = () => {
          slidingArenaRef.current?.addEventListener(
            "mousemove",
            onMouseMove,
            false,
          );
          slidingArenaRef.current?.addEventListener(
            "mouseup",
            onMouseUp,
            false,
          );
          scrollParent?.addEventListener("scroll", onScroll, false);

          slidingArenaRef.current?.addEventListener(
            "mouseover",
            onMouseOver,
            false,
          );
          slidingArenaRef.current?.addEventListener(
            "mouseout",
            resetCanvasState,
            false,
          );
          slidingArenaRef.current?.addEventListener(
            "mouseleave",
            resetCanvasState,
            false,
          );
          document.body.addEventListener("mouseup", onMouseUp, false);
          window.addEventListener("mouseup", onMouseUp, false);
        };
        const startDragging = () => {
          if (
            slidingArenaRef.current &&
            stickyCanvasRef.current &&
            scrollParent
          ) {
            initializeListeners();

            if (
              (isChildOfCanvas || isNewWidgetInitialTargetCanvas) &&
              slidingArenaRef.current
            ) {
              slidingArenaRef.current.style.zIndex = "2";
            }
          }
        };

        startDragging();

        return () => {
          slidingArenaRef.current?.removeEventListener(
            "mousemove",
            onMouseMove,
          );
          slidingArenaRef.current?.removeEventListener("mouseup", onMouseUp);
          scrollParent?.removeEventListener("scroll", onScroll);
          slidingArenaRef.current?.removeEventListener(
            "mouseover",
            onMouseOver,
          );
          slidingArenaRef.current?.removeEventListener(
            "mouseout",
            resetCanvasState,
          );
          slidingArenaRef.current?.removeEventListener(
            "mouseleave",
            resetCanvasState,
          );
          document.body.removeEventListener("mouseup", onMouseUp);
          window.removeEventListener("mouseup", onMouseUp);
        };
      } else {
        resetCanvasState();
      }
    }
  }, [isDragging, isResizing, blocksToDraw, snapRows, canExtend]);

  return {
    showCanvas: isDragging && !isResizing,
  };
};
