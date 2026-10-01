import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildLpArgs, isDirectPrintable } from "./print";

describe("buildLpArgs", () => {
  it("builds a duplex color command with a page range", () => {
    const args = buildLpArgs({
      filePath: "/tmp/a.pdf",
      systemName: "Front-Desk",
      copies: 2,
      duplex: true,
      paperSize: "A4",
      colorMode: "color",
      pageRange: "1-3",
      orderNo: "SP1",
      originalName: "a.pdf",
    });
    assert.deepEqual(args, [
      "-d",
      "Front-Desk",
      "-n",
      "2",
      "-o",
      "sides=two-sided-long-edge",
      "-o",
      "media=A4",
      "-o",
      "ColorModel=RGB",
      "-P",
      "1-3",
      "--",
      "/tmp/a.pdf",
    ]);
  });

  it("omits the page list when printing all pages", () => {
    const args = buildLpArgs({
      filePath: "/tmp/a.png",
      systemName: "Front-Desk",
      copies: 1,
      duplex: false,
      paperSize: "A3",
      colorMode: "bw",
      pageRange: "all",
      orderNo: "SP1",
      originalName: "a.png",
    });
    assert.equal(args.includes("-P"), false);
    assert.equal(args.includes("ColorModel=Gray"), true);
    assert.equal(args.includes("sides=one-sided"), true);
  });
});

describe("isDirectPrintable", () => {
  it("rejects office documents", () => {
    assert.equal(isDirectPrintable("application/pdf", "a.pdf"), true);
    assert.equal(isDirectPrintable("application/msword", "a.docx"), false);
  });
});
