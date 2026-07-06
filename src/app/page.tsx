import { amiri } from "@/utils/fonts";
import QulApp from "@/components/QulApp";

export const metadata = {
  title: "Qul",
  description: "Follow along with live Quran recitation.",
};

export default function Page() {
  return <QulApp amiriClass={amiri.className} />;
}