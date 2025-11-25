import { CONTAINER_GRID_PADDING } from "constants/WidgetConstants";
import { modifyDrawingRectangles } from "layoutSystems/common/utils/canvasDraggingUtils";
import { useSelector } from "react-redux";
import type { SpaceMap } from "reflow/reflowTypes";
import { getZoomLevel } from "selectors/editorSelectors";
import { getAbsolutePixels } from "utils/helpers";
import type {
  AlignmentGuide,
  XYCord,
} from "../../../../common/canvasArenas/ArenaTypes";
import type { WidgetDraggingBlock } from "../../../../common/canvasArenas/ArenaTypes";

const EDGE_GUIDE_COLOR = "rgba(104, 113, 239, 0.9)";
const CENTER_GUIDE_COLOR = "rgba(255, 143, 0, 0.85)";
const SPACING_GUIDE_COLOR = "rgba(52, 204, 106, 0.9)";
const EDGE_GUIDE_DASH: number[] = [];
const CENTER_GUIDE_DASH = [4, 4];
const SPACING_GUIDE_DASH = [2, 2];

/**
 * returns a method that renders dragging blocks on canvas
 * @param slidingArenaRef DOM ref of Sliding Canvas
 * @param stickyCanvasRef DOM ref of Sticky Canvas
 * @param noPad Boolean to indicate if the container type widget has padding
 * @param snapColumnSpace width between columns
 * @param snapRowSpace height between rows
 * @param getSnappedXY Method that returns XY on the canvas Grid
 * @param isCurrentDraggedCanvas boolean if the current canvas is being dragged on
 * @returns
 */
export const useRenderBlocksOnCanvas = (
  slidingArenaRef: React.RefObject<HTMLDivElement>,
  stickyCanvasRef: React.RefObject<HTMLCanvasElement>,
  noPad: boolean,
  snapColumnSpace: number,
  snapRowSpace: number,
  getSnappedXY: (
    parentColumnWidth: number,
    parentRowHeight: number,
    currentOffset: XYCord,
    parentOffset: XYCord,
  ) => {
    X: number;
    Y: number;
  },
  isCurrentDraggedCanvas: boolean,
) => {
  const canvasZoomLevel = useSelector(getZoomLevel);

  /**
   * draws the  block on canvas
   * @param blockDimensions Dimensions of block to be drawn
   * @param scrollParent DOM element of parent
   */
  const drawBlockOnCanvas = (
    blockDimensions: WidgetDraggingBlock,
    scrollParent: Element | null,
  ) => {
    if (
      stickyCanvasRef.current &&
      slidingArenaRef.current &&
      scrollParent &&
      isCurrentDraggedCanvas
    ) {
      // TODO: Fix this the next time the file is edited
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const canvasCtx: any = stickyCanvasRef.current.getContext("2d");
      const topOffset = getAbsolutePixels(stickyCanvasRef.current.style.top);
      const leftOffset = getAbsolutePixels(stickyCanvasRef.current.style.left);
      const snappedXY = getSnappedXY(
        snapColumnSpace,
        snapRowSpace,
        {
          x: blockDimensions.left,
          y: blockDimensions.top,
        },
        {
          x: 0,
          y: 0,
        },
      );

      canvasCtx.fillStyle = `${
        blockDimensions.isNotColliding
          ? "rgb(104,	113,	239, 0.6)"
          : "rgb(255,	55,	35, 0.6)"
      }`;
      canvasCtx.fillRect(
        blockDimensions.left -
          leftOffset +
          (noPad ? 0 : CONTAINER_GRID_PADDING),
        blockDimensions.top - topOffset + (noPad ? 0 : CONTAINER_GRID_PADDING),
        blockDimensions.width,
        blockDimensions.height,
      );

      const strokeWidth = 1;

      canvasCtx.setLineDash([3]);
      canvasCtx.strokeStyle = blockDimensions.isNotColliding
        ? "rgb(104,	113,	239)"
        : "red";
      canvasCtx.strokeRect(
        snappedXY.X -
          leftOffset +
          strokeWidth +
          (noPad ? 0 : CONTAINER_GRID_PADDING),
        snappedXY.Y -
          topOffset +
          strokeWidth +
          (noPad ? 0 : CONTAINER_GRID_PADDING),
        blockDimensions.width - strokeWidth,
        blockDimensions.height - strokeWidth,
      );
    }
  };

  /**
   * renders blocks on Canvas
   * @param rectanglesToDraw Rectangles that are to be drawn
   * @param spacePositionMap current dimensions of the dragging widgets
   * @param isUpdatingRows boolean
   * @param canvasIsDragging
   * @param scrollParent DOM element of parent
   * @returns
   */
  const renderBlocks = (
    rectanglesToDraw: WidgetDraggingBlock[],
    spacePositionMap: SpaceMap | undefined,
    isUpdatingRows: boolean,
    canvasIsDragging: boolean,
    scrollParent: Element | null,
    alignmentGuides?: AlignmentGuide[],
  ) => {
    let isCurrUpdatingRows = isUpdatingRows;
    const modifiedRectanglesToDraw = modifyDrawingRectangles(
      rectanglesToDraw,
      spacePositionMap,
      snapColumnSpace,
      snapRowSpace,
    );

    if (
      slidingArenaRef.current &&
      isCurrentDraggedCanvas &&
      canvasIsDragging &&
      stickyCanvasRef.current
    ) {
      // TODO: Fix this the next time the file is edited
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const canvasCtx: any = stickyCanvasRef.current.getContext("2d");

      canvasCtx.save();
      canvasCtx.clearRect(
        0,
        0,
        stickyCanvasRef.current.width,
        stickyCanvasRef.current.height,
      );
      canvasCtx.beginPath();
      isCurrUpdatingRows = false;
      canvasCtx.transform(canvasZoomLevel, 0, 0, canvasZoomLevel, 0, 0);

      if (canvasIsDragging) {
        modifiedRectanglesToDraw.forEach((each) => {
          drawBlockOnCanvas(each, scrollParent);
        });
        if (alignmentGuides?.length) {
          const topOffset = getAbsolutePixels(
            stickyCanvasRef.current.style.top,
          );
          const leftOffset = getAbsolutePixels(
            stickyCanvasRef.current.style.left,
          );
          const paddingOffset = noPad ? 0 : CONTAINER_GRID_PADDING;

          alignmentGuides.forEach((guide) => {
            let strokeStyle = EDGE_GUIDE_COLOR;
            let dashPattern = EDGE_GUIDE_DASH;
            switch (guide.kind) {
              case "center":
                strokeStyle = CENTER_GUIDE_COLOR;
                dashPattern = CENTER_GUIDE_DASH;
                break;
              case "spacing":
                strokeStyle = SPACING_GUIDE_COLOR;
                dashPattern = SPACING_GUIDE_DASH;
                break;
              default:
                break;
            }
            canvasCtx.beginPath();
            canvasCtx.strokeStyle = strokeStyle;
            canvasCtx.lineWidth = 1;
            canvasCtx.setLineDash(dashPattern);
            const startX = guide.start.x - leftOffset + paddingOffset;
            const startY = guide.start.y - topOffset + paddingOffset;
            const endX = guide.end.x - leftOffset + paddingOffset;
            const endY = guide.end.y - topOffset + paddingOffset;
            canvasCtx.moveTo(startX, startY);
            canvasCtx.lineTo(endX, endY);
            canvasCtx.stroke();
          });
        }
      }

      canvasCtx.restore();
    }

    return isCurrUpdatingRows;
  };

  return renderBlocks;
};
