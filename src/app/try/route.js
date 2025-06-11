import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import cfCheck from "@/utils/cfCheck";
import {
  localExecutablePath,
  isDev,
  userAgent,
  remoteExecutablePath,
} from "@/utils/utils";

export const maxDuration = 60; // This function can run for a maximum of 60 seconds (update by 2024-05-10)
export const dynamic = "force-dynamic";

const chromium = require("@sparticuz/chromium-min");
const puppeteer = require("puppeteer-core");

export async function GET(request) {
  const url = new URL(request.url);
  const urlStr = url.searchParams.get("url");
  if (!urlStr) {
    return NextResponse.json(
      { error: "Missing url parameter" },
      { status: 400 }
    );
  }

  let browser = null;
  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: "new",
    });
    
    // browser = await puppeteer.launch({
    //   ignoreDefaultArgs: ["--enable-automation"],
    //   args: isDev
    //     ? [
    //       "--disable-blink-features=AutomationControlled",
    //       "--disable-features=site-per-process",
    //       "--disable-site-isolation-trials",
    //     ]
    //     : [...chromium.args, "--disable-blink-features=AutomationControlled"],
    //   defaultViewport: { width: 1920, height: 1080 },
    //   executablePath: isDev
    //     ? localExecutablePath
    //     : await chromium.executablePath(remoteExecutablePath),
    //   headless: isDev ? false : "new",
    //   debuggingPort: isDev ? 9222 : undefined,
    // });
  
    const page = await browser.newPage(); // ✅ Always use newPage()
  
    await page.setUserAgent(userAgent);
    await page.setViewport({ width: 1920, height: 1080 });
  
    const preloadFile = fs.readFileSync(
      path.join(process.cwd(), "/src/utils/preload.js"),
      "utf8"
    );
    await page.evaluateOnNewDocument(preloadFile);
  
    await page.goto(urlStr, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
  
    await cfCheck(page);
  
    const blob = await page.screenshot({ type: "png" });
  
    const headers = new Headers();
    headers.set("Content-Type", "image/png");
    headers.set("Content-Length", blob.length.toString());
  
    return new NextResponse(blob, { status: 200, statusText: "OK", headers });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  } 
}
