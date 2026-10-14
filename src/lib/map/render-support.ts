let hardwareMapAvailable: boolean | undefined;

/** Software WebGL burns the phone's CPU and can fail to composite its canvas. */
export function supportsVectorMap(): boolean {
  if (hardwareMapAvailable !== undefined) return hardwareMapAvailable;
  const canvas = document.createElement("canvas");
  let context: WebGL2RenderingContext | null = null;
  try {
    context = canvas.getContext("webgl2", {
      failIfMajorPerformanceCaveat: true,
    });
    if (!context) {
      hardwareMapAvailable = false;
      return false;
    }
    const info = context.getExtension("WEBGL_debug_renderer_info");
    const renderer: string = info
      ? context.getParameter(info.UNMASKED_RENDERER_WEBGL)
      : "";
    hardwareMapAvailable = !/swiftshader|llvmpipe|software rasterizer/i.test(
      renderer,
    );
    return hardwareMapAvailable;
  } catch {
    hardwareMapAvailable = false;
    return false;
  } finally {
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
