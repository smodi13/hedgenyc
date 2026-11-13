import type { Metadata } from "next";
import { OwnerLab } from "@/components/owner/OwnerLab";

export const metadata: Metadata = {
  title: "Business Hedge Calculator",
  description: "Explore how event-based financial contracts could offset specific operating risks. Independent research tool, not affiliated with Kalshi. No trading functionality.",
};

export default function Page() {
  return <OwnerLab />;
}
