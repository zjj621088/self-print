import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectPageCount, isDirectPrintable } from "./pages";

describe("detectPageCount", () => {
  it("counts PDF pages and ignores the pages tree", () => {
    const pdf = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 2/Kids[3 0 R 4 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R>>endobj\n4 0 obj<</Type /Page /Parent 2 0 R>>endobj\n%%EOF",
      "latin1",
    );
    assert.equal(detectPageCount(pdf, "application/pdf", "notes.pdf"), 2);
  });

  it("returns 1 for images and unreadable pdfs", () => {
    assert.equal(detectPageCount(Buffer.from("not a pdf"), "application/pdf", "x.pdf"), 1);
    assert.equal(detectPageCount(Buffer.from([1, 2, 3]), "image/png", "a.png"), 1);
  });
});

describe("isDirectPrintable", () => {
  it("accepts pdf and images only", () => {
    assert.equal(isDirectPrintable("application/pdf", "a.pdf"), true);
    assert.equal(isDirectPrintable("image/jpeg", "a.jpg"), true);
    assert.equal(isDirectPrintable("application/octet-stream", "scan.png"), true);
    assert.equal(isDirectPrintable("application/msword", "a.doc"), false);
  });
});
