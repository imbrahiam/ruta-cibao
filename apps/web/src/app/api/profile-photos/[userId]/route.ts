import { profilePhotoReadUrl } from "@/modules/access/profile-photo";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/profile-photos/[userId]">,
): Promise<Response> {
  const { userId } = await params;
  if (!/^[\w-]{1,80}$/.test(userId)) return new Response(null, { status: 404 });
  const url = await profilePhotoReadUrl(userId);
  if (!url) return new Response(null, { status: 404 });
  return new Response(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "private, no-store" },
  });
}
