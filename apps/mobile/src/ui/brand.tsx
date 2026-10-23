import { BRAND_COLORS, MARK } from "@ruta/shared/brand";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

/** The app icon, drawn live: the road-to-pin mark on the pine tile. */
export function BrandMark({ size = 48 }: { size?: number }) {
  const { viewBox, road, start, pin, pinDot } = MARK;
  const scale = 0.86;
  const offset = (viewBox * (1 - scale)) / 2;
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBox} ${viewBox}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <LinearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={BRAND_COLORS.pineLight} />
          <Stop offset="1" stopColor={BRAND_COLORS.pine} />
        </LinearGradient>
      </Defs>
      <Rect
        width={viewBox}
        height={viewBox}
        rx={viewBox * 0.225}
        fill="url(#tile)"
      />
      <Path
        transform={`translate(${offset} ${offset}) scale(${scale})`}
        d={road}
        stroke={BRAND_COLORS.paper}
        strokeWidth={MARK.roadWidth}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        transform={`translate(${offset} ${offset}) scale(${scale})`}
        d={road}
        stroke={BRAND_COLORS.pine}
        strokeWidth={MARK.laneWidth}
        strokeDasharray={[...MARK.laneDash]}
        strokeLinecap="round"
        fill="none"
      />
      <Circle
        cx={offset + start.cx * scale}
        cy={offset + start.cy * scale}
        r={start.r * scale}
        fill={BRAND_COLORS.paper}
      />
      <Circle
        cx={offset + start.cx * scale}
        cy={offset + start.cy * scale}
        r={start.inner * scale}
        fill={BRAND_COLORS.pine}
      />
      <Path
        transform={`translate(${offset} ${offset}) scale(${scale})`}
        d={pin}
        fill={BRAND_COLORS.paper}
      />
      <Circle
        cx={offset + pinDot.cx * scale}
        cy={offset + pinDot.cy * scale}
        r={pinDot.r * scale}
        fill={BRAND_COLORS.pine}
      />
    </Svg>
  );
}
