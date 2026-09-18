import type { Metadata } from "next";
import ReaderClient from "@/components/reader/ReaderClient";

export const metadata: Metadata = {
  title: "在线阅读",
};

export default function ReadPage() {
  return <ReaderClient />;
}
