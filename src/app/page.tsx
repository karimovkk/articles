import { redirect } from "next/navigation";

/** Bosh sahifa: proxy.ts auth bo'lmasa /catalog ga yo'naltiradi, aks holda kutubxona. */
export default function Home() {
  redirect("/library");
}
