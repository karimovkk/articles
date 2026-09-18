import { redirect } from "next/navigation";

/** Bosh sahifa: proxy.ts auth bo'lmasa /login ga yo'naltiradi, aks holda kutubxona. */
export default function Home() {
  redirect("/library");
}
