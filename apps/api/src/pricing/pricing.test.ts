import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_PRICE_RULES } from "./defaults";
import { PricingError, parsePageRange, quoteItem, resolveBillingPageCount } from "./pricing";

describe("parsePageRange", () => {
  it("treats empty and all as every page", () => {
    assert.deepEqual(parsePageRange("", 3), [1, 2, 3]);
    assert.deepEqual(parsePageRange("all", 2), [1, 2]);
  });

  it("parses ranges and mixed lists", () => {
    assert.deepEqual(parsePageRange("1-3", 5), [1, 2, 3]);
    assert.deepEqual(parsePageRange("1,3,5-6", 6), [1, 3, 5, 6]);
    assert.deepEqual(parsePageRange("2，4", 4), [2, 4]);
  });

  it("rejects out of range and junk", () => {
    assert.throws(() => parsePageRange("1-9", 3), PricingError);
    assert.throws(() => parsePageRange("0", 3), PricingError);
    assert.throws(() => parsePageRange("a-b", 3), PricingError);
    assert.throws(() => parsePageRange(" , ", 3), PricingError);
  });
});

describe("quoteItem", () => {
  it("charges selected pages times copies times unit price", () => {
    const quoted = quoteItem({
      rules: DEFAULT_PRICE_RULES,
      pageCount: 4,
      pageRange: "1-2",
      copies: 3,
      paperSize: "A4",
      colorMode: "bw",
      duplex: false,
    });
    assert.equal(quoted.unitPrice, 20);
    assert.equal(quoted.pageCount, 2);
    assert.equal(quoted.amount, 120);
  });

  it("uses the duplex price list", () => {
    const quoted = quoteItem({
      rules: DEFAULT_PRICE_RULES,
      pageCount: 1,
      copies: 1,
      paperSize: "A4",
      colorMode: "color",
      duplex: true,
    });
    assert.equal(quoted.amount, 80);
  });

  it("rejects an unpriced spec and too many copies", () => {
    assert.throws(
      () =>
        quoteItem({
          rules: [],
          pageCount: 1,
          copies: 1,
          paperSize: "A4",
          colorMode: "bw",
          duplex: false,
        }),
      /未配置/,
    );
    assert.throws(
      () =>
        quoteItem({
          rules: DEFAULT_PRICE_RULES,
          pageCount: 1,
          copies: 21,
          paperSize: "A4",
          colorMode: "bw",
          duplex: false,
        }),
      PricingError,
    );
  });
});

describe("resolveBillingPageCount", () => {
  const pdf = { pageCount: 5, mimeType: "application/pdf", originalName: "a.pdf" };
  const doc = {
    pageCount: 1,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    originalName: "a.docx",
  };

  it("keeps detected pages for printable files", () => {
    assert.equal(resolveBillingPageCount(pdf, 12, true), 5);
  });

  it("accepts a declared page count for office files", () => {
    assert.equal(resolveBillingPageCount(doc, 12, false), 12);
    assert.equal(resolveBillingPageCount(doc, undefined, false), 1);
    assert.throws(() => resolveBillingPageCount(doc, 0, false), PricingError);
  });
});
