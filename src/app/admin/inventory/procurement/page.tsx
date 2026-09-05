import { redirect } from "next/navigation";

/**
 * The screen was one page of tabs; it is five pages now. Existing links and
 * bookmarks land here, so send them to the first section rather than 404.
 */
export default function ProcurementIndexPage() {
	redirect("/admin/inventory/procurement/buy");
}
