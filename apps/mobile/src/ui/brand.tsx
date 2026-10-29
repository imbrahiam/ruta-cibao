import { BRAND_COLORS, MARK } from "@ruta/shared/brand";
import Svg, { Circle, Path, Rect } from "react-native-svg";

/** Encuentro on the same flat iris tile used by the launcher icon. */
export function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${MARK.viewBox} ${MARK.viewBox}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Rect
        width={MARK.viewBox}
        height={MARK.viewBox}
        rx={MARK.viewBox * 0.225}
        fill={BRAND_COLORS.iris}
      />
      <Path
        d={MARK.curve}
        stroke={BRAND_COLORS.white}
        strokeWidth={MARK.strokeWidth}
        strokeLinecap="round"
        fill="none"
      />
      <Circle
        cx={MARK.point.cx}
        cy={MARK.point.cy}
        r={MARK.point.r}
        fill={BRAND_COLORS.white}
      />
    </Svg>
  );
}
