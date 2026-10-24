import { ComingSoon } from "@/components/coming-soon";
export const metadata = { title: "Assistant" };
export default function Assistant() {
  return <ComingSoon icon="sparkle" title="Production assistant" body="Ask questions about your projects — answered from your real production records, with facts, estimates and missing information clearly separated." phase="a later phase, after scheduling and collaboration" />;
}
