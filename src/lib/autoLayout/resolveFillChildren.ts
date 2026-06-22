/** Fill-child space distribution — delegates to `@/lib/layoutEngine/sizing`. */
export {
  resolveFillSize,
  calculateRemainingMainSpace,
  assignFillMainSizes,
  resolveFillSizesByGrow as calculateFillSpace,
  type FillGrowEntry,
} from "@/lib/layoutEngine/sizing";
