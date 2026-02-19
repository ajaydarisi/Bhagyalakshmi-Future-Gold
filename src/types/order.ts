import type { Database } from "./database";

export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
export type OrderItemInsert = Database["public"]["Tables"]["order_items"]["Insert"];
export type PaymentTransaction = Database["public"]["Tables"]["payment_transactions"]["Row"];

export type OrderStatus = Order["status"];

export type OrderWithItems = Order & {
  order_items: OrderItem[];
  payment_transactions?: PaymentTransaction[];
};
