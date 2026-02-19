import { ProductDetailSkeleton } from "@/components/shared/loading-skeleton";

export default function ProductDetailLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <ProductDetailSkeleton />
    </div>
  );
}
