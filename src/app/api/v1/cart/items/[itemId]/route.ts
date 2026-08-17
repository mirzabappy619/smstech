// useCart hook calls /api/v1/cart/items/:itemId for PUT and DELETE.
// The logic is identical to /api/v1/cart/:itemId — re-export those handlers.
export { PUT, DELETE } from "@/app/api/v1/cart/[itemId]/route";
