// 107: test uchun "skaner" PDF — matn faqat RASM ichida (matn qatlami yo'q). Bir marta ishga tushiriladi:
//   node e2e/mock/make-scan-pdf.mjs → e2e/mock/scan.pdf
import { writeFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { launch } from "../lib.mjs";

const html = `<html><body style="margin:0;width:1240px;height:1754px;background:#fff;font-family:Georgia,serif;color:#111">
<div style="padding:110px 120px">
<h1 style="font-size:64px;margin:0 0 30px">The Ultimate Backpacking Guide</h1>
<div style="columns:2;column-gap:60px;font-size:30px;line-height:1.5">
<p>Backpacking is more than just a way to travel. It is an immersive experience, offering once in a lifetime opportunities to explore the world on your own terms.</p>
<p>Prioritising chance encounters, flexibility and a genuine connection to the places visited, there are many benefits to this style of travel.</p>
<p>Travelling lightly with just a backpack opens up exploration to more remote areas, where you can actively engage with local communities.</p>
<p>Budget considerations will come into play here, as some countries are considerably cheaper than others.</p>
</div></div></body></html>`;

const browser = await launch();
const page = await (await browser.newContext({ viewport: { width: 1240, height: 1754 } })).newPage();
await page.setContent(html);
const png = await page.screenshot({ type: "png" });
await browser.close();

const pdf = await PDFDocument.create();
const img = await pdf.embedPng(png);
const p = pdf.addPage([595.28, 841.89]); // A4
p.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
const out = await pdf.save();
writeFileSync(new URL("./scan.pdf", import.meta.url), out);
console.log("scan.pdf", out.length, "bytes");
