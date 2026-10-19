import { prisma, upsertProduct } from "@lineskip/db";
import { jsonError } from "@/lib/http";
import { requireUser, scopedVenueIds } from "@/lib/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requireUser(request);
  if ("error" in authz) return authz.error;
  const { id } = await params;
  const ids = await scopedVenueIds(authz.user.id, ["venue_admin"]);
  if (!ids.includes(id)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const body = (await request.json()) as {
      id?: string;
      type?: string;
      name?: string;
      price_cents?: number;
      quantity_total?: number;
      valid_from?: string;
      valid_to?: string;
      is_active?: boolean;
    };
    const product = await upsertProduct(prisma, {
      id: body.id,
      venueId: id,
      type: body.type === "cover" ? "cover" : "line_skip",
      name: body.name ?? "Pass",
      priceCents: Number(body.price_cents),
      quantityTotal: Number(body.quantity_total),
      validFrom: new Date(body.valid_from ?? Date.now()),
      validTo: new Date(body.valid_to ?? Date.now()),
      isActive: body.is_active !== false,
    });
    return Response.json(product, { status: body.id ? 200 : 201 });
  } catch (err) {
    return jsonError(err);
  }
}
